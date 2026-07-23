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
  squareToCoordinate,
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
  assert.notEqual(square, null, `(${row}, ${column}) must be playable`);
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

test("square coordinates round-trip across all 50 playable squares", () => {
  for (let square = 0; square < 50; square += 1) {
    const coordinate = squareToCoordinate(square);
    assert.equal(
      coordinateToSquare(coordinate.row, coordinate.column),
      square,
    );
  }
  assert.equal(coordinateToSquare(0, 0), null);
  assert.throws(() => squareToCoordinate(50), RangeError);
});

test("initial setup has 20 men per side in four complete rows", () => {
  const state = createInitialState();
  const player1 = state.pieces.filter((candidate) => candidate.player === 1);
  const player2 = state.pieces.filter((candidate) => candidate.player === 2);

  assert.equal(state.pieces.length, 40);
  assert.equal(player1.length, 20);
  assert.equal(player2.length, 20);
  assert.ok(state.pieces.every((candidate) => candidate.kind === "man"));
  assert.deepEqual(
    player2.map((candidate) => candidate.square),
    Array.from({ length: 20 }, (_, index) => index),
  );
  assert.deepEqual(
    player1.map((candidate) => candidate.square),
    Array.from({ length: 20 }, (_, index) => index + 30),
  );
  assert.equal(state.sideToMove, 1);
});

test("men move one diagonal square forward only", () => {
  const state = createState([piece("man", 1, "man", 5, 4)], 1);
  const moves = getLegalMoves(state, config());

  assert.deepEqual(
    moves.map((move) => move.path[0]).sort((a, b) => a - b),
    [sq(4, 3), sq(4, 5)].sort((a, b) => a - b),
  );
  assert.ok(moves.every((move) => move.capturedPieceIds.length === 0));
});

test("flying kings move any unobstructed distance in all four diagonals", () => {
  const state = createState([piece("king", 1, "king", 5, 4)], 1);
  const destinations = getLegalMoves(state, config()).map(
    (move) => move.path[0],
  );

  assert.equal(destinations.length, 17);
  assert.ok(destinations.includes(sq(0, 9)));
  assert.ok(destinations.includes(sq(1, 0)));
  assert.ok(destinations.includes(sq(9, 0)));
  assert.ok(destinations.includes(sq(9, 8)));
});

test("compulsory capture suppresses every quiet move", () => {
  const state = createState(
    [
      piece("capturer", 1, "man", 5, 4),
      piece("other", 1, "man", 7, 0),
      piece("victim", 2, "man", 4, 3),
    ],
    1,
  );
  const moves = getLegalMoves(state, config());

  assert.equal(moves.length, 1);
  assert.deepEqual(moves[0].capturedPieceIds, ["victim"]);
  assert.deepEqual(moves[0].path, [sq(3, 2)]);
});

test("men capture backward when configured for Ghana draughts", () => {
  const state = createState(
    [
      piece("man", 1, "man", 5, 4),
      piece("victim", 2, "man", 6, 5),
    ],
    1,
  );

  assert.deepEqual(generateCaptures(state, "man", config()), [
    {
      pieceId: "man",
      from: sq(5, 4),
      path: [sq(7, 6)],
      capturedPieceIds: ["victim"],
      promotes: false,
    },
  ]);
  assert.equal(
    generateCaptures(
      state,
      "man",
      config({ menCaptureBackward: false }),
    ).length,
    0,
  );
});

test("flying kings capture the first opponent and may choose any empty landing beyond", () => {
  const state = createState(
    [
      piece("king", 1, "king", 7, 2),
      piece("victim", 2, "man", 4, 5),
    ],
    1,
  );
  const moves = generateCaptures(state, "king", config());

  assert.equal(moves.length, 4);
  assert.deepEqual(
    moves.map((move) => move.path[0]),
    [sq(3, 6), sq(2, 7), sq(1, 8), sq(0, 9)],
  );
  assert.ok(
    moves.every(
      (move) =>
        move.capturedPieceIds.length === 1 &&
        move.capturedPieceIds[0] === "victim",
    ),
  );
});

test("man multi-capture returns the complete forced path", () => {
  const state = createState(
    [
      piece("man", 1, "man", 6, 1),
      piece("first", 2, "man", 5, 2),
      piece("second", 2, "man", 3, 4),
    ],
    1,
  );
  const moves = generateCaptures(state, "man", config());

  assert.equal(moves.length, 1);
  assert.deepEqual(moves[0].path, [sq(4, 3), sq(2, 5)]);
  assert.deepEqual(moves[0].capturedPieceIds, ["first", "second"]);
});

test("branching captures return every complete sequence", () => {
  const state = createState(
    [
      piece("man", 1, "man", 6, 1),
      piece("first", 2, "man", 5, 2),
      piece("left", 2, "man", 3, 2),
      piece("right", 2, "man", 3, 4),
    ],
    1,
  );
  const moves = generateCaptures(state, "man", config());

  assert.equal(moves.length, 2);
  assert.deepEqual(
    moves.map((move) => move.path.at(-1)).sort((a, b) => (a ?? 0) - (b ?? 0)),
    [sq(2, 1), sq(2, 5)].sort((a, b) => a - b),
  );
  assert.ok(moves.every((move) => move.capturedPieceIds.length === 2));
});

test("maximum-capture priority is centralized and configurable", () => {
  const state = createState(
    [
      piece("long", 1, "man", 6, 1),
      piece("short", 1, "man", 6, 7),
      piece("a", 2, "man", 5, 2),
      piece("b", 2, "man", 3, 4),
      piece("c", 2, "man", 5, 8),
    ],
    1,
  );

  assert.equal(getLegalMoves(state, config()).length, 2);
  const maximumOnly = getLegalMoves(
    state,
    config({ requireMaximumCapture: true }),
  );
  assert.equal(maximumOnly.length, 1);
  assert.equal(maximumOnly[0].pieceId, "long");
  assert.equal(maximumOnly[0].capturedPieceIds.length, 2);
});

test("a quiet move promotes a man on the opponent crown row", () => {
  const state = createState([piece("man", 1, "man", 1, 2)], 1);
  const move = getLegalMoves(state, config()).find(
    (candidate) => candidate.path[0] === sq(0, 1),
  );
  assert.ok(move);
  assert.equal(move.promotes, true);

  const next = applyMove(state, move, config());
  assert.equal(next.pieces.find((candidate) => candidate.id === "man")?.kind, "king");
});

test("immediate promotion continues a capture as a flying king", () => {
  const state = createState(
    [
      piece("man", 1, "man", 2, 1),
      piece("crown-victim", 2, "man", 1, 2),
      piece("king-victim", 2, "man", 2, 5),
    ],
    1,
  );
  const moves = generateCaptures(
    state,
    "man",
    config({ promotionTiming: "immediate" }),
  );

  assert.ok(moves.length > 1);
  assert.ok(moves.every((move) => move.capturedPieceIds.length === 2));
  assert.ok(moves.every((move) => move.promotes));
  assert.ok(moves.every((move) => move.path[0] === sq(0, 3)));
});

test("end-of-turn promotion continues as a man and promotes at the final crown landing", () => {
  const state = createState(
    [
      piece("man", 1, "man", 2, 1),
      piece("crown-victim", 2, "man", 1, 2),
      piece("would-be-king-victim", 2, "man", 2, 5),
    ],
    1,
  );
  const endOfTurn = config({ promotionTiming: "end_of_turn" });
  const moves = generateCaptures(state, "man", endOfTurn);

  assert.equal(moves.length, 1);
  assert.deepEqual(moves[0].path, [sq(0, 3)]);
  assert.deepEqual(moves[0].capturedPieceIds, ["crown-victim"]);
  assert.equal(moves[0].promotes, true);
  const next = applyMove(state, moves[0], endOfTurn);
  assert.equal(next.pieces.find((candidate) => candidate.id === "man")?.kind, "king");
});

test("one piece remaining is an immediate loss when enabled", () => {
  const state = createState(
    [
      piece("last", 1, "king", 5, 4),
      piece("opponent-a", 2, "man", 1, 0),
      piece("opponent-b", 2, "man", 1, 2),
    ],
    1,
  );
  assert.deepEqual(isTerminal(state, config()), {
    winner: 2,
    loser: 1,
    reason: "one_piece_remaining",
  });
  assert.equal(
    isTerminal(state, config({ onePieceRemainingMeansLoss: false })),
    null,
  );
});

test("a side with no legal move loses", () => {
  const state = createState(
    [
      piece("stuck-a", 1, "man", 0, 1),
      piece("stuck-b", 1, "man", 0, 3),
      piece("opponent-a", 2, "man", 8, 1),
      piece("opponent-b", 2, "man", 8, 3),
    ],
    1,
  );
  assert.deepEqual(
    isTerminal(state, config({ onePieceRemainingMeansLoss: false })),
    { winner: 2, loser: 1, reason: "no_legal_moves" },
  );
});

test("validation rejects wrong origins, opponent pieces, and quiet moves during capture", () => {
  const state = createState(
    [
      piece("man", 1, "man", 5, 4),
      piece("victim", 2, "man", 4, 3),
      piece("other", 2, "man", 1, 0),
    ],
    1,
  );
  const illegal: Move = {
    pieceId: "man",
    from: sq(5, 4),
    path: [sq(4, 5)],
    capturedPieceIds: [],
    promotes: false,
  };
  assert.equal(validateMove(state, illegal, config()).valid, false);
  assert.throws(() => applyMove(state, illegal, config()), /not legal/);

  assert.equal(
    validateMove(
      state,
      { ...illegal, pieceId: "other", from: sq(1, 0) },
      config(),
    ).valid,
    false,
  );
});

test("applyMove is immutable and updates clocks, side, captures, and hash", () => {
  const state = createState(
    [
      piece("man", 1, "man", 5, 4),
      piece("victim", 2, "man", 4, 3),
      piece("survivor", 2, "man", 1, 0),
    ],
    1,
    { moveNumber: 7, halfMoveClock: 4 },
  );
  const move = getLegalMoves(state, config())[0];
  const next = applyMove(state, move, config());

  assert.equal(state.pieces.length, 3);
  assert.equal(next.pieces.length, 2);
  assert.equal(next.sideToMove, 2);
  assert.equal(next.moveNumber, 8);
  assert.equal(next.halfMoveClock, 0);
  assert.notEqual(next.positionHash, state.positionHash);
  assert.equal(next.forcedPieceId, undefined);
});
