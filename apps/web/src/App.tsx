import { useEffect, useRef, useState } from "react";
import {
  createInitialState,
  createState,
  type Player,
} from "../../../packages/game-engine/src/index.ts";
import { Board } from "./components/Board.tsx";
import { GameControls } from "./components/GameControls.tsx";
import { MoveHistory } from "./components/MoveHistory.tsx";
import { PlayerCard } from "./components/PlayerCard.tsx";
import { useDialogFocus } from "./components/useDialogFocus.ts";
import {
  acceptComputerDraw,
  applyComputerSearchResult,
  createComputerSearchRequest,
  isComputerTurn,
} from "./game/computer.ts";
import type { ComputerSearchResponse } from "./game/computer.ts";
import { playGameSound } from "./game/audio.ts";
import {
  chooseDestination,
  createGameSession,
  interactionView,
  offerDraw,
  resignGame,
  respondToDraw,
  restartGame,
  selectPiece,
} from "./game/controller.ts";
import {
  ComputerActionGuard,
  shouldDisableGameInput,
} from "./game/input.ts";
import { createMatch, recordGameResult } from "./game/match.ts";
import type {
  BoardOrientation,
  GameOptions,
  GameResult,
  GameSession,
  MatchState,
  OpponentType,
} from "./game/types.ts";
import { MenuScreen } from "./screens/MenuScreen.tsx";
import { SetupScreen } from "./screens/SetupScreen.tsx";

type Screen = "menu" | "setup" | "game";

function playerName(options: GameOptions, player: Player): string {
  if (options.opponentType === "human") {
    return player === 1 ? options.playerName : options.opponentName;
  }
  return player === options.humanSide
    ? options.playerName
    : options.opponentName;
}

function resultText(result: GameResult | undefined, options: GameOptions): string {
  if (!result) return "";
  if (!result.winner) {
    if (result.reason === "draw_repetition") return "Game drawn by threefold repetition";
    if (result.reason === "draw_no_progress") return "Game drawn by the no-progress rule";
    return "Game drawn by agreement";
  }
  const reason = result.reason.replaceAll("_", " ");
  return `${playerName(options, result.winner)} wins · ${reason}`;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [setupOpponent, setSetupOpponent] = useState<OpponentType>("human");
  const [session, setSession] = useState<GameSession>(() => createGameSession());
  const [match, setMatch] = useState<MatchState>(() => createMatch());
  const [orientation, setOrientation] =
    useState<BoardOrientation>("player1");
  const [sound, setSound] = useState(true);
  const [thinking, setThinking] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notice, setNotice] = useState<string>();
  const recordedResult = useRef<GameResult | undefined>(undefined);
  const computerActionGuard = useRef(new ComputerActionGuard());
  const computerWorker = useRef<Worker | null>(null);
  const soundedPly = useRef(0);
  const soundedResult = useRef<GameResult | undefined>(undefined);

  const cancelPendingComputerAction = () => {
    computerActionGuard.current.cancel();
    computerWorker.current?.terminate();
    computerWorker.current = null;
    setThinking(false);
  };

  const beginSetup = (opponent: OpponentType) => {
    setSetupOpponent(opponent);
    setScreen("setup");
  };

  const startMatch = (options: GameOptions) => {
    cancelPendingComputerAction();
    recordedResult.current = undefined;
    setSession(createGameSession(options));
    setMatch(createMatch(options.matchTarget));
    setOrientation(options.orientation);
    setNotice(undefined);
    setScreen("game");
  };

  const beginRound = () => {
    cancelPendingComputerAction();
    recordedResult.current = undefined;
    setSession((current) => {
      const initial = createInitialState();
      const board = createState(initial.pieces, match.roundStarter);
      return createGameSession(current.options, board);
    });
    setNotice(undefined);
  };

  useEffect(() => {
    if (
      session.result &&
      recordedResult.current !== session.result
    ) {
      recordedResult.current = session.result;
      setMatch((current) => recordGameResult(current, session.result!));
    }
  }, [session.result]);

  useEffect(() => {
    if (session.history.length === 0) {
      soundedPly.current = 0;
      soundedResult.current = undefined;
      return;
    }
    const latest = session.history.at(-1);
    if (!latest || latest.ply <= soundedPly.current) return;
    soundedPly.current = latest.ply;
    playGameSound(
      latest.promoted ? "promotion" : latest.captures > 0 ? "capture" : "move",
      sound,
    );
  }, [session.history, sound]);

  useEffect(() => {
    if (!session.result || soundedResult.current === session.result) return;
    soundedResult.current = session.result;
    playGameSound(session.result.winner ? "win" : "draw", sound);
  }, [session.result, sound]);

  const dialogOpen = settingsOpen ||
    Boolean(session.drawOfferedBy && session.options.opponentType === "human") ||
    Boolean(session.status === "finished" && session.result);
  useDialogFocus(dialogOpen, settingsOpen ? () => setSettingsOpen(false) : undefined);

  const computerTurn =
    screen === "game" &&
    isComputerTurn(session);

  useEffect(() => {
    if (!computerTurn) {
      setThinking(false);
      return;
    }
    const actionGeneration = computerActionGuard.current.start();
    const request = createComputerSearchRequest(session, actionGeneration);
    if (!request) return;
    const worker = new Worker(
      new URL("./game/titan.worker.ts", import.meta.url),
      { type: "module" },
    );
    computerWorker.current = worker;
    setThinking(true);
    worker.onmessage = (event: MessageEvent<ComputerSearchResponse>) => {
      const response = event.data;
      if (
        !computerActionGuard.current.isCurrent(actionGeneration) ||
        response.requestId !== actionGeneration ||
        response.positionHash !== request.positionHash
      ) {
        return;
      }
      worker.terminate();
      if (computerWorker.current === worker) computerWorker.current = null;
      setSession((current) => {
        if (!computerActionGuard.current.isCurrent(actionGeneration)) {
          return current;
        }
        return applyComputerSearchResult(
          current,
          request.positionHash,
          response.result,
        );
      });
      if (computerActionGuard.current.isCurrent(actionGeneration)) {
        setThinking(false);
      }
    };
    worker.onerror = () => {
      if (!computerActionGuard.current.isCurrent(actionGeneration)) return;
      worker.terminate();
      if (computerWorker.current === worker) computerWorker.current = null;
      setThinking(false);
      setNotice("Titan could not complete that search.");
    };
    worker.postMessage(request);
    return () => {
      worker.terminate();
      if (computerWorker.current === worker) computerWorker.current = null;
      computerActionGuard.current.cancel();
    };
  }, [computerTurn, session]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(undefined), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  if (screen === "menu") {
    return (
      <MenuScreen
        onNew={() => beginSetup("human")}
        onHuman={() => beginSetup("human")}
        onComputer={() => beginSetup("computer")}
        sound={sound}
        onSound={() => {
          playGameSound("click", true);
          setSound((current) => !current);
        }}
      />
    );
  }

  if (screen === "setup") {
    return (
      <SetupScreen
        initialOpponent={setupOpponent}
        onBack={() => setScreen("menu")}
        onStart={startMatch}
      />
    );
  }

  const view = interactionView(session);
  const player1 = playerName(session.options, 1);
  const player2 = playerName(session.options, 2);
  const round =
    session.status === "finished" ? Math.max(1, match.round - 1) : match.round;
  const gameInputDisabled = shouldDisableGameInput({
    computerTurn,
    thinking,
    status: session.status,
  });
  const requestDraw = () => {
    if (session.status !== "playing") return;
    const offeredBy =
      session.options.opponentType === "computer"
        ? session.options.humanSide
        : session.board.sideToMove;
    const offered = offerDraw(session, offeredBy);
    if (session.options.opponentType === "computer") {
      const accepted = acceptComputerDraw(session.board);
      setSession(respondToDraw(offered, accepted));
      if (!accepted) {
        setNotice(`${session.options.opponentName} rejected the draw.`);
      }
      return;
    }
    setSession(offered);
  };
  const matchComplete = match.winner !== undefined;

  return (
    <main className="game-screen">
      <header className="game-header">
        <button
          className="wordmark"
          type="button"
          onClick={() => {
            cancelPendingComputerAction();
            setScreen("menu");
          }}
        >
          TITAN <span>V3</span>
        </button>
        <div className="match-strip">
          <span>GAME {round}</span>
          <strong>{match.player1Score} — {match.player2Score}</strong>
          <span>FIRST TO {match.target}</span>
          {match.draws > 0 && <span>{match.draws} DRAW{match.draws > 1 ? "S" : ""}</span>}
        </div>
        <button
          className="header-settings"
          type="button"
          aria-label="Settings"
          onClick={() => setSettingsOpen(true)}
        >⚙</button>
      </header>

      <div className="game-layout">
        <aside className="players-column">
          <div className="match-title">
            <span className="eyebrow">Live match</span>
            <h1>Ghana<br />Draughts</h1>
          </div>
          <PlayerCard
            board={session.board}
            player={2}
            name={player2}
            active={session.board.sideToMove === 2 && session.status === "playing"}
            score={match.player2Score}
          />
          <div className="versus-line"><span>VS</span></div>
          <PlayerCard
            board={session.board}
            player={1}
            name={player1}
            active={session.board.sideToMove === 1 && session.status === "playing"}
            score={match.player1Score}
          />
          <dl className="match-details">
            <div><dt>Round</dt><dd>{round}</dd></div>
            <div><dt>Target</dt><dd>{match.target} wins</dd></div>
            <div><dt>Draws</dt><dd>{match.draws}</dd></div>
          </dl>
        </aside>

        <section className="board-column">
          <div className={`turn-banner ${view.captureRequired ? "capture" : ""}`}>
            <span className={`turn-dot player-${session.board.sideToMove}`} />
            <div>
              <strong>
                {thinking
                  ? `${session.options.opponentName} is thinking…`
                  : view.captureRequired
                    ? "Capture required"
                    : `${playerName(session.options, session.board.sideToMove)} to move`}
              </strong>
              <small>
                {session.pathPrefix.length > 0
                  ? "Continue with the same piece"
                  : view.captureRequired
                    ? "Only highlighted pieces can move"
                    : `Move ${session.board.moveNumber}`}
              </small>
            </div>
          </div>
          <Board
            session={session}
            orientation={orientation}
            appearance={session.options.pieceAppearance}
            disabled={gameInputDisabled}
            onPiece={(pieceId) =>
              setSession((current) => selectPiece(current, pieceId))
            }
            onDestination={(square) =>
              setSession((current) => chooseDestination(current, square))
            }
          />
          <div className="mobile-score">
            <span>{player1} <strong>{match.player1Score}</strong></span>
            <span>Game {round} · first to {match.target}</span>
            <span><strong>{match.player2Score}</strong> {player2}</span>
          </div>
        </section>

        <aside className="record-column">
          <details className="mobile-history" open>
            <summary>Move history · {session.history.length}</summary>
            <MoveHistory
              entries={session.history}
              result={resultText(session.result, session.options)}
            />
          </details>
          <GameControls
            sound={sound}
            gameInputDisabled={gameInputDisabled}
            onNew={() => {
              cancelPendingComputerAction();
              setScreen("setup");
            }}
            onRestart={() => {
              cancelPendingComputerAction();
              recordedResult.current = undefined;
              setSession((current) => restartGame(current));
            }}
            onResign={() =>
              setSession((current) =>
                resignGame(
                  current,
                  current.options.opponentType === "computer"
                    ? current.options.humanSide
                    : current.board.sideToMove,
                ),
              )
            }
            onDraw={requestDraw}
            onFlip={() =>
              setOrientation((current) =>
                current === "player1" ? "player2" : "player1",
              )
            }
            onSound={() => {
              playGameSound("click", true);
              setSound((current) => !current);
            }}
            onSettings={() => setSettingsOpen(true)}
          />
        </aside>
      </div>

      {session.drawOfferedBy && session.options.opponentType === "human" && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="draw-title">
            <span className="modal-symbol">½</span>
            <span className="eyebrow">Draw request</span>
            <h2 id="draw-title">
              {playerName(session.options, session.drawOfferedBy)} offers a draw
            </h2>
            <p>The other player must accept for this game to end level.</p>
            <div className="modal-actions">
              <button type="button" onClick={() => setSession((current) => respondToDraw(current, false))}>
                Reject
              </button>
              <button className="primary-action" type="button" onClick={() => setSession((current) => respondToDraw(current, true))}>
                Accept draw
              </button>
            </div>
          </section>
        </div>
      )}

      {session.status === "finished" && session.result && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-card result-card" role="dialog" aria-modal="true" aria-labelledby="result-title">
            <span className="modal-symbol">{session.result.winner ? "♛" : "½"}</span>
            <span className="eyebrow">{matchComplete ? "Match complete" : `Game ${round} complete`}</span>
            <h2 id="result-title">{resultText(session.result, session.options)}</h2>
            <p>
              Match score {match.player1Score}–{match.player2Score}
              {match.draws ? ` · ${match.draws} draw${match.draws > 1 ? "s" : ""}` : ""}
            </p>
            <div className="modal-actions stacked-mobile">
              {!matchComplete && (
                <button className="primary-action" type="button" onClick={beginRound}>
                  Next game →
                </button>
              )}
              <button type="button" onClick={() => startMatch(session.options)}>Rematch</button>
              <button
                type="button"
                onClick={() => {
                  cancelPendingComputerAction();
                  setScreen("menu");
                }}
              >
                Return to menu
              </button>
            </div>
          </section>
        </div>
      )}

      {settingsOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setSettingsOpen(false)}>
          <section className="modal-card settings-card" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" aria-label="Close settings" onClick={() => setSettingsOpen(false)}>×</button>
            <span className="eyebrow">Preferences</span>
            <h2 id="settings-title">Game settings</h2>
            <button type="button" onClick={() => {
              playGameSound("click", true);
              setSound((current) => !current);
            }}>
              Sound <strong>{sound ? "On" : "Off"}</strong>
            </button>
            {screen === "game" && (
              <button type="button" onClick={() => setOrientation((current) => current === "player1" ? "player2" : "player1")}>
                Board orientation <strong>Flip</strong>
              </button>
            )}
            <p>More themes, motion, and accessibility controls arrive in a later phase.</p>
          </section>
        </div>
      )}

      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}
