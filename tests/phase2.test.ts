import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_RULE_CONFIG,
  createInitialState,
  createState,
  getLegalMoves,
  validateMove,
  type Piece,
} from "../packages/game-engine/src/index.ts";
import {
  chooseDestination,
  createGameSession,
  interactionView,
  offerDraw,
  playCanonicalMove,
  resignGame,
  respondToDraw,
  selectPiece,
} from "../apps/web/src/game/controller.ts";
import { basicComputerPolicy } from "../apps/web/src/game/computer.ts";
import { createMatch, recordGameResult } from "../apps/web/src/game/match.ts";

const piece = (
  id: string,
  player: 1 | 2,
  square: number,
  kind: "man" | "king" = "man",
): Piece => ({ id, player, square, kind });

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
  match = recordGameResult(match, { winner: 1, reason: "resignation" });
  match = recordGameResult(match, { reason: "draw_agreement" });
  match = recordGameResult(match, { winner: 1, reason: "no_legal_moves" });
  assert.equal(match.player1Score, 2);
  assert.equal(match.draws, 1);
  assert.equal(match.winner, 1);
});

test("temporary computer selects a legal move and prefers most captures", () => {
  const board = createState([
    piece("p1-a", 1, 41),
    piece("p1-b", 1, 43),
    piece("p2-a", 2, 36),
    piece("p2-b", 2, 26),
    piece("p2-c", 2, 38),
    piece("p2-safe", 2, 5),
  ]);
  const selected = basicComputerPolicy.chooseMove(board)!;
  assert.equal(validateMove(board, selected, DEFAULT_RULE_CONFIG).valid, true);
  const maximum = Math.max(
    ...getLegalMoves(board, DEFAULT_RULE_CONFIG).map(
      (move) => move.capturedPieceIds.length,
    ),
  );
  assert.equal(selected.capturedPieceIds.length, maximum);
});
