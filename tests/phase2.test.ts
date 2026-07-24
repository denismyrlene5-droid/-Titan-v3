import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_RULE_CONFIG,
  createInitialState,
  createState,
  getLegalMoves,
  type Piece,
} from "../packages/game-engine/src/index.ts";
import {
  chooseMove,
  type Difficulty,
} from "../packages/titan-ai/src/index.ts";
import {
  chooseDestination,
  createGameSession,
  interactionView,
  offerDraw,
  playCanonicalMove,
  restartGame,
  resignGame,
  respondToDraw,
  selectPiece,
} from "../apps/web/src/game/controller.ts";
import {
  applyComputerSearchResult,
  createComputerSearchRequest,
  isComputerTurn,
} from "../apps/web/src/game/computer.ts";
import {
  ComputerActionGuard,
  shouldDisableGameInput,
} from "../apps/web/src/game/input.ts";
import { createMatch, recordGameResult } from "../apps/web/src/game/match.ts";

const piece = (
  id: string,
  player: 1 | 2,
  square: number,
  kind: "man" | "king" = "man",
): Piece => ({ id, player, square, kind });

function unfinishedMultiCapture() {
  const board = createState([
    piece("p1-a", 1, 41),
    piece("p1-b", 1, 43),
    piece("p2-a", 2, 36),
    piece("p2-b", 2, 26),
    piece("p2-c", 2, 17),
    piece("p2-d", 2, 38),
    piece("p2-safe", 2, 5),
  ]);
  const move = getLegalMoves(board, DEFAULT_RULE_CONFIG).find(
    (candidate) => candidate.pieceId === "p1-a",
  )!;
  assert.equal(move.path.length, 3);

  let session = selectPiece(createGameSession({}, board), move.pieceId);
  session = chooseDestination(session, move.path[0]!);
  assert.deepEqual(session.pathPrefix, [move.path[0]!]);
  return { board, move, session };
}

test("UI interaction submits a canonical engine move", () => {
  let session = createGameSession({}, createInitialState());
  const move = getLegalMoves(session.board, DEFAULT_RULE_CONFIG)[0]!;
  session = selectPiece(session, move.pieceId);
  session = chooseDestination(session, move.path[0]!);
  assert.notEqual(session.board.positionHash, createInitialState().positionHash);
  assert.equal(session.history.length, 1);
});

test("illegal pieces and destinations are ignored", () => {
  const initial = createGameSession();
  const opponentPiece = initial.board.pieces.find((candidate) => candidate.player === 2)!;
  const selected = selectPiece(initial, opponentPiece.id);
  const moved = chooseDestination(selected, 25);
  assert.strictEqual(selected, initial);
  assert.strictEqual(moved, initial);
});

test("compulsory capture view exposes only capturing pieces", () => {
  const board = createState([
    piece("p1-a", 1, 31),
    piece("p1-b", 1, 33),
    piece("p2-a", 2, 26),
    piece("p2-safe", 2, 5),
  ]);
  const view = interactionView(createGameSession({}, board));
  assert.equal(view.captureRequired, true);
  assert.deepEqual([...view.selectablePieceIds], ["p1-a"]);
});

test("multi-capture remains selected and exposes continuation only", () => {
  const board = createState([
    piece("p1-a", 1, 41),
    piece("p2-a", 2, 36),
    piece("p2-b", 2, 26),
    piece("p2-safe", 2, 5),
  ]);
  const fullMove = getLegalMoves(board, DEFAULT_RULE_CONFIG)[0]!;
  assert.equal(fullMove.path.length, 2);
  let session = selectPiece(createGameSession({}, board), "p1-a");
  session = chooseDestination(session, fullMove.path[0]!);
  const view = interactionView(session);
  assert.equal(session.selectedPieceId, "p1-a");
  assert.deepEqual([...view.destinations], [fullMove.path[1]!]);
  session = chooseDestination(session, fullMove.path[1]!);
  assert.equal(session.selectedPieceId, undefined);
  assert.equal(session.history[0]?.captures, 2);
});

test("unfinished multi-capture ignores piece reselection and invalid clicks", () => {
  const { move, session } = unfinishedMultiCapture();

  assert.strictEqual(selectPiece(session, move.pieceId), session);
  assert.strictEqual(selectPiece(session, "p1-b"), session);
  assert.strictEqual(chooseDestination(session, move.from), session);
  assert.equal(session.selectedPieceId, move.pieceId);
  assert.deepEqual(session.pathPrefix, [move.path[0]!]);
  assert.equal(session.history.length, 0);
});

test("legal multi-capture continuation advances without submitting early", () => {
  const { board, move, session } = unfinishedMultiCapture();
  const advanced = chooseDestination(session, move.path[1]!);
  const view = interactionView(advanced);

  assert.notStrictEqual(advanced, session);
  assert.strictEqual(advanced.board, board);
  assert.equal(advanced.selectedPieceId, move.pieceId);
  assert.deepEqual(advanced.pathPrefix, move.path.slice(0, 2));
  assert.deepEqual([...view.destinations], [move.path[2]!]);
  assert.equal(advanced.history.length, 0);
  assert.equal(advanced.lastMove, undefined);
});

test("complete multi-capture submits once, removes captures, and clears selection", () => {
  const { move, session } = unfinishedMultiCapture();
  const advanced = chooseDestination(session, move.path[1]!);
  const completed = chooseDestination(advanced, move.path[2]!);
  const completedAgain = chooseDestination(completed, move.path[2]!);
  const view = interactionView(completed);

  assert.equal(completed.history.length, 1);
  assert.deepEqual(completed.lastMove, move);
  assert.deepEqual(completed.history[0]?.capturedPieceIds, [
    "p2-a",
    "p2-b",
    "p2-c",
  ]);
  assert.equal(completed.history[0]?.captures, 3);
  assert.ok(
    move.capturedPieceIds.every(
      (pieceId) =>
        !completed.board.pieces.some((candidate) => candidate.id === pieceId),
    ),
  );
  assert.equal(completed.selectedPieceId, undefined);
  assert.deepEqual(completed.pathPrefix, []);
  assert.equal(view.selectedPieceId, undefined);
  assert.equal(view.destinations.size, 0);
  assert.strictEqual(completedAgain, completed);
  assert.equal(completedAgain.history.length, 1);
});

test("completed move clears selection highlights and records last move", () => {
  let session = createGameSession();
  const move = getLegalMoves(session.board, DEFAULT_RULE_CONFIG)[0]!;
  session = selectPiece(session, move.pieceId);
  session = chooseDestination(session, move.path[0]!);
  const view = interactionView(session);
  assert.equal(view.selectedPieceId, undefined);
  assert.equal(view.destinations.size, 0);
  assert.deepEqual(session.lastMove, move);
});

test("promotion is surfaced in move history", () => {
  const board = createState([
    piece("p1-a", 1, 6),
    piece("p1-safe", 1, 49),
    piece("p2-a", 2, 45),
    piece("p2-b", 2, 46),
  ]);
  const promotion = getLegalMoves(board, DEFAULT_RULE_CONFIG).find((move) => move.promotes)!;
  const session = playCanonicalMove(createGameSession({}, board), promotion);
  assert.equal(session.history[0]?.promoted, true);
  assert.equal(session.board.pieces.find((candidate) => candidate.id === "p1-a")?.kind, "king");
});

test("resignation awards the game to the opponent", () => {
  const session = resignGame(createGameSession(), 1);
  assert.deepEqual(session.result, { winner: 2, reason: "resignation" });
});

test("draw offer can be rejected or accepted", () => {
  const offered = offerDraw(createGameSession(), 1);
  const rejected = respondToDraw(offered, false);
  assert.equal(rejected.status, "playing");
  assert.equal(rejected.drawOfferedBy, undefined);
  const accepted = respondToDraw(offerDraw(rejected, 2), true);
  assert.deepEqual(accepted.result, { reason: "draw_agreement" });
});

test("match scoring counts wins and draws and finds a target winner", () => {
  let match = createMatch(2);
  assert.equal(match.roundStarter, 1);
  match = recordGameResult(match, { winner: 1, reason: "resignation" });
  assert.equal(match.roundStarter, 2);
  match = recordGameResult(match, { reason: "draw_agreement" });
  assert.equal(match.roundStarter, 1);
  match = recordGameResult(match, { winner: 1, reason: "no_legal_moves" });
  assert.equal(match.player1Score, 2);
  assert.equal(match.draws, 1);
  assert.equal(match.winner, 1);
  assert.equal(match.roundStarter, 2);
});

test("successive match rounds alternate the side to move", () => {
  const initial = createInitialState();
  let match = createMatch(5);

  for (const expectedStarter of [1, 2, 1, 2] as const) {
    const roundBoard = createState(initial.pieces, match.roundStarter);
    const roundSession = createGameSession({}, roundBoard);
    assert.equal(roundSession.board.sideToMove, expectedStarter);
    assert.equal(roundSession.initialState.sideToMove, expectedStarter);
    match = recordGameResult(match, { reason: "draw_agreement" });
  }
});

test("Titan moves first when the human chooses Player 2", () => {
  const session = createGameSession({
    opponentType: "computer",
    humanSide: 2,
    opponentName: "Titan V3",
    aiDifficulty: "hard",
  });
  const request = createComputerSearchRequest(session, 11)!;
  const result = chooseMove(request.state, request.difficulty, {
    maxDepth: 1,
    timeLimitMs: 5_000,
    randomMoveChance: 0,
  });
  const moved = applyComputerSearchResult(
    session,
    request.positionHash,
    result,
  );

  assert.equal(request.requestId, 11);
  assert.equal(request.difficulty, "hard");
  assert.equal(request.positionHash, session.board.positionHash);
  assert.equal(moved.history.length, 1);
  assert.equal(moved.board.sideToMove, 2);
  assert.deepEqual(moved.lastMove, result.move);
  assert.equal(isComputerTurn(moved), false);
  assert.strictEqual(
    applyComputerSearchResult(moved, request.positionHash, result),
    moved,
  );
});

test("Titan responds after a Player 1 human move", () => {
  let session = createGameSession({
    opponentType: "computer",
    humanSide: 1,
    aiDifficulty: "medium",
  });
  session = playCanonicalMove(
    session,
    getLegalMoves(session.board, DEFAULT_RULE_CONFIG)[0]!,
  );
  const request = createComputerSearchRequest(session, 12)!;
  const result = chooseMove(request.state, request.difficulty, {
    maxDepth: 1,
    timeLimitMs: 5_000,
    randomMoveChance: 0,
  });
  const moved = applyComputerSearchResult(
    session,
    request.positionHash,
    result,
  );

  assert.equal(isComputerTurn(session), true);
  assert.equal(request.difficulty, "medium");
  assert.equal(moved.history.length, 2);
  assert.equal(moved.board.sideToMove, 1);
  assert.equal(isComputerTurn(moved), false);
});

test("all five selected difficulties reach the computer search request", () => {
  const difficulties: readonly Difficulty[] = [
    "easy",
    "medium",
    "hard",
    "master",
    "titan",
  ];

  for (const difficulty of difficulties) {
    const session = createGameSession({
      opponentType: "computer",
      humanSide: 2,
      aiDifficulty: difficulty,
    });
    assert.equal(
      createComputerSearchRequest(session, 1)?.difficulty,
      difficulty,
    );
  }
});

test("stale computer search results cannot alter an advanced session", () => {
  const session = createGameSession({
    opponentType: "computer",
    humanSide: 2,
  });
  const request = createComputerSearchRequest(session, 13)!;
  const result = chooseMove(request.state, request.difficulty, {
    maxDepth: 1,
    timeLimitMs: 5_000,
    randomMoveChance: 0,
  });
  const advanced = applyComputerSearchResult(
    session,
    request.positionHash,
    result,
  );

  assert.strictEqual(
    applyComputerSearchResult(advanced, request.positionHash, result),
    advanced,
  );
  assert.strictEqual(
    applyComputerSearchResult(
      session,
      `${request.positionHash}-stale`,
      result,
    ),
    session,
  );
});

test("Titan completes a forced multi-capture as one recorded move", () => {
  const board = createState([
    piece("p1-a", 1, 41),
    piece("p1-safe", 1, 49),
    piece("p2-a", 2, 36),
    piece("p2-b", 2, 26),
    piece("p2-safe", 2, 5),
  ]);
  const session = createGameSession(
    {
      opponentType: "computer",
      humanSide: 2,
      aiDifficulty: "hard",
    },
    board,
  );
  const request = createComputerSearchRequest(session, 14)!;
  const result = chooseMove(request.state, request.difficulty, {
    maxDepth: 1,
    timeLimitMs: 5_000,
    randomMoveChance: 0,
  });
  const moved = applyComputerSearchResult(
    session,
    request.positionHash,
    result,
  );

  assert.equal(result.move?.path.length, 2);
  assert.equal(moved.history.length, 1);
  assert.equal(moved.history[0]?.captures, 2);
  assert.deepEqual(moved.history[0]?.capturedPieceIds, ["p2-a", "p2-b"]);
  assert.ok(
    ["p2-a", "p2-b"].every(
      (id) => !moved.board.pieces.some((candidate) => candidate.id === id),
    ),
  );
});

test("game-changing input disables only when play is not available", () => {
  assert.equal(
    shouldDisableGameInput({
      computerTurn: false,
      thinking: false,
      status: "playing",
    }),
    false,
  );
  assert.equal(
    shouldDisableGameInput({
      computerTurn: true,
      thinking: false,
      status: "playing",
    }),
    true,
  );
  assert.equal(
    shouldDisableGameInput({
      computerTurn: false,
      thinking: true,
      status: "playing",
    }),
    true,
  );
  assert.equal(
    shouldDisableGameInput({
      computerTurn: false,
      thinking: false,
      status: "finished",
    }),
    true,
  );
});

test("restart and rematch invalidate an in-flight result at the same hash", () => {
  const session = createGameSession({
    opponentType: "computer",
    humanSide: 2,
  });
  const guard = new ComputerActionGuard();
  const restartAction = guard.start();
  const request = createComputerSearchRequest(session, restartAction)!;
  const result = chooseMove(request.state, request.difficulty, {
    maxDepth: 1,
    timeLimitMs: 5_000,
    randomMoveChance: 0,
  });
  const restarted = restartGame(session);
  guard.cancel();

  const afterRestart = guard.isCurrent(restartAction)
    ? applyComputerSearchResult(restarted, request.positionHash, result)
    : restarted;
  assert.equal(guard.isCurrent(restartAction), false);
  assert.strictEqual(afterRestart, restarted);
  assert.equal(restarted.history.length, 0);
  assert.equal(restarted.board.positionHash, session.board.positionHash);

  const rematchAction = guard.start();
  const rematched = createGameSession(session.options);
  guard.cancel();
  const afterRematch = guard.isCurrent(rematchAction)
    ? applyComputerSearchResult(rematched, request.positionHash, result)
    : rematched;
  assert.equal(guard.isCurrent(rematchAction), false);
  assert.strictEqual(afterRematch, rematched);
  assert.equal(rematched.board.positionHash, session.board.positionHash);
});
