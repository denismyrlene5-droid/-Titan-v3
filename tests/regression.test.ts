import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_RULE_CONFIG,
  applyMove,
  coordinateToSquare,
  createInitialState,
  createState,
  generateCaptures,
  getLegalMoves,
  isTerminal,
  validateMove,
} from "../packages/game-engine/src/index.ts";
import type {
  Move,
  Piece,
  Player,
  RuleConfig,
} from "../packages/game-engine/src/index.ts";

function sq(row: number, column: number): number {
  const square = coordinateToSquare(row, column);
  assert.notEqual(square, null);
  return square;
}

function piece(
  id: string,
  player: Player,
  kind: Piece["kind"],
  row: number,
  column: number,
): Piece {
  return { id, player, kind, square: sq(row, column) };
}

function config(overrides: Partial<RuleConfig> = {}): RuleConfig {
  return { ...DEFAULT_RULE_CONFIG, ...overrides };
}

test("regression: starting arrangement always creates forty unique pieces", () => {
  const state = createInitialState();
  assert.equal(new Set(state.pieces.map((candidate) => candidate.id)).size, 40);
  assert.equal(
    new Set(state.pieces.map((candidate) => candidate.square)).size,
    40,
  );
  assert.equal(state.pieces.filter((candidate) => candidate.player === 1).length, 20);
  assert.equal(state.pieces.filter((candidate) => candidate.player === 2).length, 20);
});

test("regression: compulsory capture cannot be bypassed by any caller, including AI", () => {
  const state = createState(
    [
      piece("forced", 1, "man", 5, 4),
      piece("idle", 1, "man", 7, 0),
      piece("victim", 2, "man", 4, 3),
    ],
    1,
  );
  const moves = getLegalMoves(state, config());

  assert.ok(moves.length > 0);
  assert.ok(moves.every((move) => move.capturedPieceIds.length > 0));
  assert.ok(moves.every((move) => move.pieceId === "forced"));
});

test("regression: a partial multi-capture is never a legal move", () => {
  const state = createState(
    [
      piece("man", 1, "man", 6, 1),
      piece("first", 2, "man", 5, 2),
      piece("second", 2, "man", 3, 4),
    ],
    1,
  );
  const partial: Move = {
    pieceId: "man",
    from: sq(6, 1),
    path: [sq(4, 3)],
    capturedPieceIds: ["first"],
    promotes: false,
  };

  assert.equal(validateMove(state, partial, config()).valid, false);
  assert.equal(getLegalMoves(state, config())[0].capturedPieceIds.length, 2);
});

test("regression: final winning capture applies without freeze and ends the game", () => {
  const state = createState(
    [
      piece("king", 1, "king", 8, 1),
      piece("first", 2, "man", 6, 3),
      piece("second", 2, "man", 3, 6),
    ],
    1,
  );
  const winning = getLegalMoves(state, config()).find(
    (move) => move.capturedPieceIds.length === 2,
  );
  assert.ok(winning);

  const next = applyMove(state, winning, config());
  assert.equal(next.pieces.filter((candidate) => candidate.player === 2).length, 0);
  assert.deepEqual(isTerminal(next, config()), {
    winner: 1,
    loser: 2,
    reason: "no_pieces",
  });
});

test("regression: flying king continues after its first capture", () => {
  const state = createState(
    [
      piece("king", 1, "king", 8, 1),
      piece("first", 2, "man", 6, 3),
      piece("second", 2, "man", 3, 6),
    ],
    1,
  );
  const moves = generateCaptures(state, "king", config());

  assert.ok(moves.some((move) => move.capturedPieceIds.length === 2));
  assert.ok(
    moves
      .filter((move) => move.path[0] === sq(5, 4))
      .every((move) => move.capturedPieceIds.length === 2),
  );
});

test("regression: king backward capture is generated", () => {
  const state = createState(
    [
      piece("king", 1, "king", 3, 2),
      piece("behind", 2, "man", 5, 4),
    ],
    1,
  );
  const moves = generateCaptures(state, "king", config());

  assert.ok(moves.length > 0);
  assert.ok(moves.every((move) => move.capturedPieceIds[0] === "behind"));
  assert.ok(moves.some((move) => move.path[0] === sq(6, 5)));
});

test("regression: a capture sequence never captures the same piece twice", () => {
  const state = createState(
    [
      piece("king", 1, "king", 7, 0),
      piece("a", 2, "man", 5, 2),
      piece("b", 2, "man", 2, 5),
      piece("c", 2, "man", 5, 6),
    ],
    1,
  );
  const moves = generateCaptures(state, "king", config());

  for (const move of moves) {
    assert.equal(
      new Set(move.capturedPieceIds).size,
      move.capturedPieceIds.length,
    );
  }
});

test("regression: exact path validation prevents a highlighted destination mismatch", () => {
  const state = createState(
    [
      piece("king", 1, "king", 7, 2),
      piece("victim", 2, "man", 4, 5),
    ],
    1,
  );
  const canonical = getLegalMoves(state, config())[0];
  const wrongDestination: Move = {
    ...canonical,
    path: [sq(6, 1)],
  };

  assert.equal(validateMove(state, canonical, config()).valid, true);
  assert.equal(validateMove(state, wrongDestination, config()).valid, false);
});

test("regression: immediate crown promotion unlocks king continuation", () => {
  const state = createState(
    [
      piece("man", 1, "man", 2, 1),
      piece("first", 2, "man", 1, 2),
      piece("second", 2, "man", 2, 5),
    ],
    1,
  );

  const immediate = getLegalMoves(
    state,
    config({ promotionTiming: "immediate" }),
  );
  assert.ok(immediate.every((move) => move.capturedPieceIds.length === 2));
  assert.ok(immediate.every((move) => move.promotes));

  const delayed = getLegalMoves(
    state,
    config({ promotionTiming: "end_of_turn" }),
  );
  assert.equal(delayed.length, 1);
  assert.equal(delayed[0].capturedPieceIds.length, 1);
});

test("regression: after a completed capture the turn changes and no forced prompt remains", () => {
  const state = createState(
    [
      piece("man", 1, "man", 5, 4),
      piece("victim", 2, "man", 4, 3),
      piece("opponent-a", 2, "man", 1, 0),
      piece("opponent-b", 2, "man", 1, 2),
    ],
    1,
    { forcedPieceId: "man" },
  );
  const move = getLegalMoves(state, config())[0];
  const next = applyMove(state, move, config());

  assert.equal(next.sideToMove, 2);
  assert.equal(next.forcedPieceId, undefined);
  assert.ok(getLegalMoves(next, config()).every((candidate) => candidate.pieceId !== "man"));
});
