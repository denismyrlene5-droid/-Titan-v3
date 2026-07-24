import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_RULE_CONFIG,
  applyMove,
  coordinateToSquare,
  createInitialState,
  createState,
  getLegalMoves,
  isTerminal,
  validateMove,
} from "../packages/game-engine/src/index.ts";
import type {
  BoardState,
  Move,
  Piece,
  Player,
  RuleConfig,
} from "../packages/game-engine/src/index.ts";
import {
  DIFFICULTY_CONFIGS,
  LOSS_SCORE,
  TranspositionTable,
  WIN_SCORE,
  chooseMove,
  evaluatePosition,
  moveKey,
  movesEqual,
  orderMoves,
  resolveAIConfig,
  searchPosition,
} from "../packages/titan-ai/src/index.ts";
import type { AIConfig } from "../packages/titan-ai/src/index.ts";

function sq(row: number, column: number): number {
  const square = coordinateToSquare(row, column);
  if (square === null) {
    throw new Error(`(${row}, ${column}) must be playable`);
  }
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

function rules(overrides: Partial<RuleConfig> = {}): RuleConfig {
  return { ...DEFAULT_RULE_CONFIG, ...overrides };
}

function hardMove(
  state: BoardState,
  overrides: Partial<AIConfig> = {},
): ReturnType<typeof chooseMove> {
  return chooseMove(state, "hard", {
    maxDepth: 2,
    timeLimitMs: 5_000,
    ...overrides,
  });
}

function assertLegal(state: BoardState, move: Move | null): asserts move is Move {
  assert.ok(move, "AI should return a move");
  assert.equal(validateMove(state, move, DEFAULT_RULE_CONFIG).valid, true);
}

test("AI always returns a canonical legal move", () => {
  const state = createInitialState();
  const result = hardMove(state, { maxDepth: 1 });

  assertLegal(state, result.move);
  assert.ok(
    getLegalMoves(state, DEFAULT_RULE_CONFIG).some((candidate) =>
      movesEqual(candidate, result.move),
    ),
  );
});

test("regression: AI cannot bypass compulsory capture", () => {
  const state = createState(
    [
      piece("forced", 1, "man", 5, 4),
      piece("support", 1, "man", 8, 1),
      piece("victim", 2, "man", 4, 3),
      piece("safe-a", 2, "man", 1, 0),
      piece("safe-b", 2, "man", 1, 2),
    ],
    1,
  );
  const result = hardMove(state);

  assertLegal(state, result.move);
  assert.equal(result.move.pieceId, "forced");
  assert.deepEqual(result.move.capturedPieceIds, ["victim"]);
});

test("regression: an obvious forced move returns without deep search", () => {
  const state = createState(
    [
      piece("forced", 1, "man", 5, 4),
      piece("support", 1, "man", 8, 1),
      piece("victim", 2, "man", 4, 3),
      piece("safe-a", 2, "man", 1, 0),
      piece("safe-b", 2, "man", 1, 2),
    ],
    1,
  );
  const result = chooseMove(state, "titan", {
    maxDepth: 10,
    timeLimitMs: 7_000,
  });

  assertLegal(state, result.move);
  assert.equal(result.nodes, 1);
  assert.equal(result.depthReached, 1);
  assert.equal(result.timedOut, false);
});

test("regression: AI submits the complete multi-capture sequence", () => {
  const state = createState(
    [
      piece("man", 1, "man", 6, 1),
      piece("support", 1, "man", 8, 7),
      piece("first", 2, "man", 5, 2),
      piece("second", 2, "man", 3, 4),
      piece("safe", 2, "man", 1, 0),
    ],
    1,
  );
  const result = hardMove(state);

  assertLegal(state, result.move);
  assert.deepEqual(result.move.path, [sq(4, 3), sq(2, 5)]);
  assert.deepEqual(result.move.capturedPieceIds, ["first", "second"]);
});

test("AI prefers an immediate win", () => {
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
  const result = hardMove(state, { maxDepth: 1 });

  assertLegal(state, result.move);
  assert.equal(result.move.pieceId, "long");
  assert.equal(result.move.capturedPieceIds.length, 2);
  assert.equal(
    isTerminal(
      applyMove(state, result.move, DEFAULT_RULE_CONFIG),
      DEFAULT_RULE_CONFIG,
    )?.winner,
    1,
  );
});

test("AI avoids an immediate loss when a safe move exists", () => {
  const state = createState(
    [
      { id: "safe-mover", player: 1, kind: "man", square: 34 },
      { id: "exposed", player: 1, kind: "man", square: 18 },
      { id: "attacker", player: 2, kind: "man", square: 8 },
      { id: "support", player: 2, kind: "man", square: 40 },
    ],
    1,
  );
  const result = hardMove(state, { maxDepth: 2 });

  assertLegal(state, result.move);
  assert.equal(result.move.pieceId, "safe-mover");
  assert.deepEqual(result.move.path, [29]);
});

test("AI prefers a larger capture sequence without a forced terminal win", () => {
  const state = createState(
    [
      piece("long", 1, "man", 6, 1),
      piece("short", 1, "man", 6, 7),
      piece("a", 2, "man", 5, 2),
      piece("b", 2, "man", 3, 4),
      piece("c", 2, "man", 5, 8),
      piece("safe", 2, "man", 1, 0),
    ],
    1,
  );
  const result = hardMove(state, { maxDepth: 1 });

  assertLegal(state, result.move);
  assert.equal(result.move.pieceId, "long");
  assert.equal(result.move.capturedPieceIds.length, 2);
});

test("AI chooses promotion when it is strategically superior", () => {
  const state = createState(
    [
      piece("crown-runner", 1, "man", 1, 2),
      piece("support", 1, "man", 6, 1),
      piece("opponent-a", 2, "man", 7, 6),
      piece("opponent-b", 2, "man", 7, 8),
    ],
    1,
  );
  const result = hardMove(state, { maxDepth: 1, useQuiescence: false });

  assertLegal(state, result.move);
  assert.equal(result.move.pieceId, "crown-runner");
  assert.equal(result.move.promotes, true);
});

test("Easy can make varied choices while every choice remains legal", () => {
  const state = createInitialState();
  const first = chooseMove(state, "easy", {
    maxDepth: 1,
    timeLimitMs: 5_000,
    randomMoveChance: 1,
    random: () => 0,
  });
  const last = chooseMove(state, "easy", {
    maxDepth: 1,
    timeLimitMs: 5_000,
    randomMoveChance: 1,
    random: () => 0.999,
  });

  assertLegal(state, first.move);
  assertLegal(state, last.move);
  assert.equal(movesEqual(first.move, last.move), false);
});

test("Hard is deterministic and ignores the random source", () => {
  const state = createInitialState();
  const first = hardMove(state, { random: () => 0 });
  const second = hardMove(state, { random: () => 0.999 });

  assertLegal(state, first.move);
  assertLegal(state, second.move);
  assert.ok(movesEqual(first.move, second.move));
  assert.equal(first.score, second.score);
});

test("timeout returns a legal move from the last fully completed depth", () => {
  const state = createInitialState();
  let tick = 0;
  const result = chooseMove(state, "medium", {
    maxDepth: 5,
    timeLimitMs: 25,
    randomMoveChance: 0,
    useQuiescence: false,
    now: () => tick++,
  });

  assertLegal(state, result.move);
  assert.equal(result.timedOut, true);
  assert.ok(result.depthReached >= 1);
  assert.ok(result.depthReached < 5);
  assert.ok(movesEqual(result.move, result.principalVariation[0] ?? null));
});

test("transposition-table entries are reused across searches", () => {
  const state = createInitialState();
  const table = new TranspositionTable(2_000);
  const first = hardMove(state, {
    maxDepth: 2,
    transpositionTable: table,
  });
  const hitsAfterFirst = table.hits;
  const second = hardMove(state, {
    maxDepth: 2,
    transpositionTable: table,
  });

  assertLegal(state, first.move);
  assertLegal(state, second.move);
  assert.ok(table.size > 0);
  assert.ok(table.hits > hitsAfterFirst);
  assert.ok(second.nodes < first.nodes);
  assert.ok(movesEqual(first.move, second.move));
});

test("terminal positions return no move", () => {
  const state = createState(
    [
      piece("last", 1, "king", 5, 4),
      piece("opponent-a", 2, "man", 1, 0),
      piece("opponent-b", 2, "man", 1, 2),
    ],
    1,
  );
  const result = hardMove(state);

  assert.equal(result.move, null);
  assert.equal(result.score, LOSS_SCORE);
  assert.equal(result.depthReached, 0);
  assert.deepEqual(result.principalVariation, []);
});

test("handcrafted evaluation applies the one-piece-remaining loss rule", () => {
  const state = createState(
    [
      piece("last", 1, "king", 5, 4),
      piece("opponent-a", 2, "man", 1, 0),
      piece("opponent-b", 2, "man", 1, 2),
    ],
    1,
  );

  assert.equal(evaluatePosition(state, 1, rules()), LOSS_SCORE);
  assert.ok(
    evaluatePosition(
      state,
      1,
      rules({ onePieceRemainingMeansLoss: false }),
    ) > LOSS_SCORE,
  );
});

test("AI handles flying-king captures through engine-generated moves", () => {
  const state = createState(
    [
      piece("king", 1, "king", 7, 2),
      piece("support", 1, "man", 9, 0),
      piece("victim", 2, "man", 4, 5),
      piece("safe-a", 2, "man", 1, 0),
      piece("safe-b", 2, "man", 1, 2),
    ],
    1,
  );
  const result = hardMove(state);

  assertLegal(state, result.move);
  assert.equal(result.move.pieceId, "king");
  assert.deepEqual(result.move.capturedPieceIds, ["victim"]);
  const landing = result.move.path[0];
  if (landing === undefined) throw new Error("Expected a king landing.");
  assert.ok(landing === sq(3, 6) || landing < sq(3, 6));
});

test("AI handles backward man captures through the engine", () => {
  const state = createState(
    [
      piece("man", 1, "man", 5, 4),
      piece("support", 1, "man", 8, 1),
      piece("behind", 2, "man", 6, 5),
      piece("safe-a", 2, "man", 1, 0),
      piece("safe-b", 2, "man", 1, 2),
    ],
    1,
  );
  const result = hardMove(state);

  assertLegal(state, result.move);
  assert.deepEqual(result.move.path, [sq(7, 6)]);
  assert.deepEqual(result.move.capturedPieceIds, ["behind"]);
});

test("regression: immediate promotion preserves the complete king continuation", () => {
  const state = createState(
    [
      piece("man", 1, "man", 2, 1),
      piece("support", 1, "man", 8, 1),
      piece("first", 2, "man", 1, 2),
      piece("second", 2, "man", 2, 5),
      piece("safe", 2, "man", 7, 8),
    ],
    1,
  );
  const result = hardMove(state);

  assertLegal(state, result.move);
  assert.equal(result.move.promotes, true);
  assert.ok(result.move.capturedPieceIds.length >= 2);
  assert.ok(result.move.capturedPieceIds.includes("first"));
  assert.ok(result.move.capturedPieceIds.includes("second"));
  assert.equal(result.move.path[0], sq(0, 3));
});

test("regression: a flying king continues beyond its first capture", () => {
  const state = createState(
    [
      piece("king", 1, "king", 8, 1),
      piece("support", 1, "man", 9, 8),
      piece("first", 2, "man", 6, 3),
      piece("second", 2, "man", 3, 6),
      piece("safe", 2, "man", 1, 0),
    ],
    1,
  );
  const result = hardMove(state);

  assertLegal(state, result.move);
  assert.equal(result.move.capturedPieceIds.length, 2);
  assert.deepEqual(result.move.capturedPieceIds, ["first", "second"]);
});

test("search never mutates its input board state", () => {
  const state = createInitialState();
  const before = JSON.stringify(state);
  const pieceReferences = [...state.pieces];
  hardMove(state, { maxDepth: 3 });

  assert.equal(JSON.stringify(state), before);
  assert.deepEqual(state.pieces, pieceReferences);
  assert.equal(Object.isFrozen(state), true);
  assert.equal(Object.isFrozen(state.pieces), true);
});

test("evaluation is symmetric and rewards an obvious material advantage", () => {
  const state = createState(
    [
      piece("gold-king", 1, "king", 8, 1),
      piece("gold-a", 1, "man", 8, 5),
      piece("gold-b", 1, "man", 6, 1),
      piece("onyx-a", 2, "man", 1, 0),
      piece("onyx-b", 2, "man", 1, 4),
      piece("onyx-c", 2, "man", 3, 8),
    ],
    1,
  );
  const gold = evaluatePosition(state, 1, DEFAULT_RULE_CONFIG);
  const onyx = evaluatePosition(state, 2, DEFAULT_RULE_CONFIG);

  assert.equal(gold, -onyx);
  assert.ok(gold > 0, `Expected the king advantage to be positive, got ${gold}`);
  assert.ok(Math.abs(gold) < WIN_SCORE);
});

test("move ordering preserves every engine move and prioritizes the table move", () => {
  const state = createInitialState();
  const legalMoves = getLegalMoves(state, DEFAULT_RULE_CONFIG);
  const tableMove = legalMoves.at(-1)!;
  const ordered = orderMoves(
    state,
    legalMoves,
    DEFAULT_RULE_CONFIG,
    tableMove,
  );

  assert.equal(movesEqual(ordered[0] ?? null, tableMove), true);
  assert.deepEqual(
    ordered.map(moveKey).sort(),
    legalMoves.map(moveKey).sort(),
  );
});

test("transposition entries keep bounds and search contexts separate", () => {
  const table = new TranspositionTable(20);
  table.beginSearch();
  table.store({
    hash: "same-position",
    perspective: 1,
    contextKey: "evaluation-a",
    depth: 3,
    score: 40,
    bound: "lower",
    bestMove: null,
  });
  table.store({
    hash: "same-position",
    perspective: 1,
    contextKey: "evaluation-b",
    depth: 2,
    score: -15,
    bound: "upper",
    bestMove: null,
  });

  assert.equal(
    table.peek("same-position", 1, "evaluation-a")?.bound,
    "lower",
  );
  assert.equal(
    table.peek("same-position", 1, "evaluation-b")?.bound,
    "upper",
  );
  assert.equal(table.peek("same-position", 1, "missing"), undefined);
});

test("an illegal cached best move cannot escape as the root result", () => {
  const state = createInitialState();
  const table = new TranspositionTable(200);
  const config = resolveAIConfig("hard", {
    maxDepth: 1,
    timeLimitMs: 5_000,
    transpositionTable: table,
  });
  const legal = getLegalMoves(state, DEFAULT_RULE_CONFIG)[0]!;
  table.store({
    hash: state.positionHash,
    perspective: state.sideToMove,
    contextKey: config.transpositionContextKey,
    depth: 99,
    score: WIN_SCORE,
    bound: "exact",
    bestMove: {
      ...legal,
      path: [49],
    },
  });

  const result = searchPosition(state, config);
  assertLegal(state, result.move);
  assert.notEqual(result.score, WIN_SCORE);
});

test("identical positions reuse the table regardless of piece-array order", () => {
  const initial = createInitialState();
  const reordered = createState(
    [...initial.pieces].reverse(),
    initial.sideToMove,
  );
  const table = new TranspositionTable(2_000);
  const first = hardMove(initial, {
    maxDepth: 2,
    transpositionTable: table,
  });
  const second = hardMove(reordered, {
    maxDepth: 2,
    transpositionTable: table,
  });

  assert.equal(initial.positionHash, reordered.positionHash);
  assertLegal(reordered, second.move);
  assert.ok(second.transpositionTableHits > 0);
  assert.ok(second.nodes < first.nodes);
});

test("timeout fallback is immediate, legal, and does not randomize", () => {
  const state = createInitialState();
  const result = chooseMove(state, "easy", {
    maxDepth: 10,
    timeLimitMs: 0,
    randomMoveChance: 1,
    random: () => 0.999,
  });

  assertLegal(state, result.move);
  assert.equal(result.depthReached, 0);
  assert.equal(result.timedOut, true);
  assert.equal(result.nodes, 0);
  assert.ok(movesEqual(result.move, getLegalMoves(state, DEFAULT_RULE_CONFIG)[0]!));
});

test("timeout leaves only the last completed root depth in the table", () => {
  const state = createInitialState();
  const table = new TranspositionTable(2_000);
  let tick = 0;
  const config = resolveAIConfig("hard", {
    maxDepth: 8,
    timeLimitMs: 30,
    randomMoveChance: 0,
    transpositionTable: table,
    now: () => tick++,
  });
  const result = searchPosition(state, config);
  const rootEntry = table.peek(
    state.positionHash,
    state.sideToMove,
    config.transpositionContextKey,
  );

  assertLegal(state, result.move);
  assert.equal(result.timedOut, true);
  assert.ok(result.depthReached >= 1);
  assert.equal(rootEntry?.depth, result.depthReached);
  assert.equal(rootEntry?.bound, "exact");
});

test("a small real-time budget returns promptly with a legal move", () => {
  const state = createInitialState();
  const startedAt = Date.now();
  const result = chooseMove(state, "titan", {
    maxDepth: 20,
    timeLimitMs: 5,
  });
  const wallTime = Date.now() - startedAt;

  assertLegal(state, result.move);
  assert.ok(wallTime < 250, `Search took ${wallTime} ms for a 5 ms budget`);
});

test("quiescence avoids a capture horizon mistake even at its safety cap", () => {
  const state = createState(
    [
      { id: "p0", player: 1, kind: "man", square: 10 },
      { id: "p1", player: 1, kind: "man", square: 43 },
      { id: "p2", player: 1, kind: "man", square: 26 },
      { id: "p3", player: 2, kind: "king", square: 17 },
      { id: "p4", player: 2, kind: "man", square: 27 },
      { id: "p5", player: 2, kind: "man", square: 18 },
    ],
    1,
  );
  const withoutQuiescence = chooseMove(state, "hard", {
    maxDepth: 1,
    timeLimitMs: 5_000,
    randomMoveChance: 0,
    useQuiescence: false,
    useTranspositionTable: false,
  });
  const withQuiescence = chooseMove(state, "hard", {
    maxDepth: 1,
    timeLimitMs: 5_000,
    randomMoveChance: 0,
    useQuiescence: true,
    maxQuiescenceDepth: 0,
    useTranspositionTable: false,
  });

  assert.deepEqual(withoutQuiescence.move?.path, [21]);
  assert.deepEqual(withQuiescence.move?.path, [20]);
  const safeChild = applyMove(
    state,
    withQuiescence.move!,
    DEFAULT_RULE_CONFIG,
  );
  assert.equal(
    getLegalMoves(safeChild, DEFAULT_RULE_CONFIG).some(
      (move) => move.capturedPieceIds.length > 0,
    ),
    false,
  );
});

test("difficulty profiles have genuinely different search limits", () => {
  assert.deepEqual(
    Object.values(DIFFICULTY_CONFIGS).map((config) => config.maxDepth),
    [1, 3, 5, 7, 10],
  );
  assert.deepEqual(
    Object.values(DIFFICULTY_CONFIGS).map((config) => config.timeLimitMs),
    [100, 500, 1_500, 3_500, 7_000],
  );
  assert.equal(DIFFICULTY_CONFIGS.easy.useQuiescence, false);
  assert.equal(DIFFICULTY_CONFIGS.titan.useQuiescence, true);
  assert.equal(DIFFICULTY_CONFIGS.easy.useTranspositionTable, false);
  assert.equal(DIFFICULTY_CONFIGS.titan.useTranspositionTable, true);
});

test("no-legal-move terminal state returns no AI move", () => {
  const state = createState(
    [
      piece("blocked-a", 1, "man", 0, 1),
      piece("blocked-b", 1, "man", 0, 3),
      piece("opponent-a", 2, "man", 9, 0),
      piece("opponent-b", 2, "man", 9, 2),
    ],
    1,
  );
  const result = hardMove(state);

  assert.equal(isTerminal(state, DEFAULT_RULE_CONFIG)?.reason, "no_legal_moves");
  assert.equal(result.move, null);
  assert.equal(result.score, LOSS_SCORE);
});

test("search diagnostics report pruning and table activity", () => {
  const result = hardMove(createInitialState(), { maxDepth: 3 });

  assert.ok(result.cutoffs > 0);
  assert.ok(result.transpositionTableHits > 0);
  assert.ok(result.nodes > 0);
  assert.equal(result.principalVariation.length > 0, true);
});
