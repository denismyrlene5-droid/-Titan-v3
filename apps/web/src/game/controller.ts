import {
  DEFAULT_RULE_CONFIG,
  applyMove,
  createInitialState,
  getLegalMoves,
  isTerminal,
  validateMove,
  type BoardState,
  type Move,
  type Player,
} from "../../../../packages/game-engine/src/index.ts";
import type {
  GameOptions,
  GameResult,
  GameSession,
  HistoryEntry,
  InteractionView,
} from "./types.ts";

export const DEFAULT_GAME_OPTIONS: GameOptions = Object.freeze({
  playerName: "Player 1",
  opponentName: "Player 2",
  opponentType: "human",
  humanSide: 1,
  pieceAppearance: "gold",
  orientation: "player1",
  aiDifficulty: "easy",
  matchTarget: 3,
});

export const REPETITION_DRAW_COUNT = 3;
export const NO_PROGRESS_PLY_LIMIT = 80;

export function createGameSession(
  options: Partial<GameOptions> = {},
  board: BoardState = createInitialState(),
): GameSession {
  const mergedOptions = Object.freeze({ ...DEFAULT_GAME_OPTIONS, ...options });
  return Object.freeze({
    initialState: board,
    board,
    options: mergedOptions,
    pathPrefix: Object.freeze([]),
    history: Object.freeze([]),
    positionCounts: Object.freeze({ [board.positionHash]: 1 }),
    status: "playing",
  });
}

export function interactionView(session: GameSession): InteractionView {
  if (session.status === "finished") {
    return {
      legalMoves: [],
      selectablePieceIds: new Set(),
      destinations: new Set(),
      captureRequired: false,
      pathPrefix: [],
    };
  }

  const legalMoves = getLegalMoves(session.board, DEFAULT_RULE_CONFIG);
  const captureRequired = legalMoves.some(
    (move) => move.capturedPieceIds.length > 0,
  );
  const selectablePieceIds = new Set(legalMoves.map((move) => move.pieceId));
  const candidates = session.selectedPieceId
    ? legalMoves.filter(
        (move) =>
          move.pieceId === session.selectedPieceId &&
          session.pathPrefix.every(
            (square, index) => move.path[index] === square,
          ),
      )
    : [];
  const nextIndex = session.pathPrefix.length;
  const destinations = new Set(
    candidates
      .map((move) => move.path[nextIndex])
      .filter((square): square is number => square !== undefined),
  );

  return {
    legalMoves,
    selectablePieceIds,
    destinations,
    captureRequired,
    selectedPieceId: session.selectedPieceId,
    pathPrefix: session.pathPrefix,
  };
}

export function selectPiece(
  session: GameSession,
  pieceId: string,
): GameSession {
  if (session.status !== "playing") return session;
  if (session.pathPrefix.length > 0) return session;
  const view = interactionView(session);
  if (!view.selectablePieceIds.has(pieceId)) return session;
  return Object.freeze({
    ...session,
    selectedPieceId: pieceId,
    pathPrefix: Object.freeze([]),
  });
}

function formatNotation(move: Move): string {
  const separator = move.capturedPieceIds.length > 0 ? " × " : " – ";
  return [move.from + 1, ...move.path.map((square) => square + 1)].join(
    separator,
  );
}

function historyEntry(
  session: GameSession,
  move: Move,
): HistoryEntry {
  return Object.freeze({
    ply: session.history.length + 1,
    player: session.board.sideToMove,
    from: move.from,
    path: Object.freeze([...move.path]),
    captures: move.capturedPieceIds.length,
    capturedPieceIds: Object.freeze([...move.capturedPieceIds]),
    promoted: move.promotes,
    notation: formatNotation(move),
  });
}

function terminalResult(board: BoardState): GameResult | undefined {
  const terminal = isTerminal(board, DEFAULT_RULE_CONFIG);
  return terminal
    ? { winner: terminal.winner, reason: terminal.reason }
    : undefined;
}

function adjudicateResult(
  board: BoardState,
  positionCounts: Readonly<Record<string, number>>,
): GameResult | undefined {
  const decisive = terminalResult(board);
  if (decisive) return decisive;
  if ((positionCounts[board.positionHash] ?? 0) >= REPETITION_DRAW_COUNT) {
    return { reason: "draw_repetition" };
  }
  if (board.halfMoveClock >= NO_PROGRESS_PLY_LIMIT) {
    return { reason: "draw_no_progress" };
  }
  return undefined;
}

function completeMove(session: GameSession, canonical: Move): GameSession {
  const board = applyMove(session.board, canonical, DEFAULT_RULE_CONFIG);
  const positionCounts = Object.freeze({
    ...session.positionCounts,
    [board.positionHash]: (session.positionCounts[board.positionHash] ?? 0) + 1,
  });
  const result = adjudicateResult(board, positionCounts);
  return Object.freeze({
    ...session,
    board,
    positionCounts,
    selectedPieceId: undefined,
    pathPrefix: Object.freeze([]),
    lastMove: canonical,
    history: Object.freeze([...session.history, historyEntry(session, canonical)]),
    status: result ? "finished" : "playing",
    result,
    drawOfferedBy: undefined,
  });
}

export function chooseDestination(
  session: GameSession,
  square: number,
): GameSession {
  if (session.status !== "playing" || !session.selectedPieceId) return session;
  const view = interactionView(session);
  if (!view.destinations.has(square)) return session;

  const nextPath = Object.freeze([...session.pathPrefix, square]);
  const candidates = view.legalMoves.filter(
    (move) =>
      move.pieceId === session.selectedPieceId &&
      nextPath.every((destination, index) => move.path[index] === destination),
  );
  const completed = candidates.find((move) => move.path.length === nextPath.length);
  const hasContinuation = candidates.some(
    (move) => move.path.length > nextPath.length,
  );

  if (!completed || hasContinuation) {
    return Object.freeze({ ...session, pathPrefix: nextPath });
  }

  const validation = validateMove(
    session.board,
    completed,
    DEFAULT_RULE_CONFIG,
  );
  if (!validation.valid || !validation.canonicalMove) return session;

  return completeMove(session, validation.canonicalMove);
}

export function playCanonicalMove(
  session: GameSession,
  move: Move,
): GameSession {
  if (session.status !== "playing") return session;
  const validation = validateMove(session.board, move, DEFAULT_RULE_CONFIG);
  if (!validation.valid || !validation.canonicalMove) return session;
  return completeMove(session, validation.canonicalMove);
}

export function resignGame(
  session: GameSession,
  player: Player,
): GameSession {
  if (session.status !== "playing") return session;
  return Object.freeze({
    ...session,
    status: "finished",
    selectedPieceId: undefined,
    pathPrefix: Object.freeze([]),
    drawOfferedBy: undefined,
    result: Object.freeze({
      winner: player === 1 ? 2 : 1,
      reason: "resignation",
    }),
  });
}

export function offerDraw(
  session: GameSession,
  player: Player,
): GameSession {
  if (session.status !== "playing" || session.drawOfferedBy) return session;
  return Object.freeze({ ...session, drawOfferedBy: player });
}

export function respondToDraw(
  session: GameSession,
  accepted: boolean,
): GameSession {
  if (session.status !== "playing" || !session.drawOfferedBy) return session;
  if (!accepted) {
    return Object.freeze({ ...session, drawOfferedBy: undefined });
  }
  return Object.freeze({
    ...session,
    status: "finished",
    drawOfferedBy: undefined,
    selectedPieceId: undefined,
    pathPrefix: Object.freeze([]),
    result: Object.freeze({ reason: "draw_agreement" }),
  });
}

export function restartGame(session: GameSession): GameSession {
  return createGameSession(session.options, session.initialState);
}
