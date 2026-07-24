import {
  coordinateToSquare,
  createInitialState,
  createState,
  type BoardState,
  type Move,
  type Piece,
  type Player,
} from "../packages/game-engine/src/index.ts";
import { chooseMove } from "../packages/titan-ai/src/index.ts";

interface BenchmarkPosition {
  readonly name: string;
  readonly state: BoardState;
}

function sq(row: number, column: number): number {
  const square = coordinateToSquare(row, column);
  if (square === null) {
    throw new Error(`(${row}, ${column}) must be a playable square`);
  }
  return square;
}

const piece = (
  id: string,
  player: Player,
  kind: Piece["kind"],
  row: number,
  column: number,
): Piece => ({
  id,
  player,
  kind,
  square: sq(row, column),
});

const POSITIONS: readonly BenchmarkPosition[] = [
  {
    name: "opening",
    state: createInitialState(),
  },
  {
    name: "compulsory capture",
    state: createState([
      piece("gold-capturer", 1, "man", 6, 1),
      piece("gold-safe", 1, "man", 8, 7),
      piece("onyx-victim", 2, "man", 5, 2),
      piece("onyx-safe", 2, "man", 1, 8),
    ]),
  },
  {
    name: "branching multi-capture",
    state: createState([
      piece("gold-branch", 1, "man", 6, 1),
      piece("gold-safe", 1, "man", 8, 7),
      piece("onyx-first", 2, "man", 5, 2),
      piece("onyx-left", 2, "man", 3, 2),
      piece("onyx-right", 2, "man", 3, 4),
      piece("onyx-safe", 2, "man", 1, 8),
    ]),
  },
  {
    name: "king-heavy position",
    state: createState([
      piece("gold-king-a", 1, "king", 8, 1),
      piece("gold-king-b", 1, "king", 7, 6),
      piece("gold-man", 1, "man", 6, 9),
      piece("onyx-king-a", 2, "king", 1, 8),
      piece("onyx-king-b", 2, "king", 2, 3),
      piece("onyx-man", 2, "man", 3, 0),
    ]),
  },
  {
    name: "promotion race",
    state: createState([
      piece("gold-racer", 1, "man", 1, 2),
      piece("gold-support", 1, "man", 4, 7),
      piece("onyx-racer", 2, "man", 8, 7),
      piece("onyx-support", 2, "man", 5, 2),
    ]),
  },
  {
    name: "tactical trap",
    state: createState([
      { id: "gold-a", player: 1, kind: "man", square: 10 },
      { id: "gold-b", player: 1, kind: "man", square: 43 },
      { id: "gold-c", player: 1, kind: "man", square: 26 },
      { id: "onyx-king", player: 2, kind: "king", square: 17 },
      { id: "onyx-a", player: 2, kind: "man", square: 27 },
      { id: "onyx-b", player: 2, kind: "man", square: 18 },
    ]),
  },
  {
    name: "endgame",
    state: createState([
      piece("gold-king", 1, "king", 8, 1),
      piece("gold-man", 1, "man", 6, 7),
      piece("onyx-king", 2, "king", 1, 8),
      piece("onyx-man", 2, "man", 3, 2),
    ]),
  },
];

function formatMove(move: Move | null): string {
  if (!move) return "(none)";
  const separator = move.capturedPieceIds.length > 0 ? "x" : "-";
  return `${move.from}${separator}${move.path.join(separator)}`;
}

function formatLine(line: readonly Move[]): string {
  return line.map(formatMove).join(" ") || "(empty)";
}

console.log("Titan V3 Phase 3 representative-position benchmark");
console.log("Profile: Hard, deterministic, 250 ms maximum per position");
console.log("");

for (const { name, state } of POSITIONS) {
  const result = chooseMove(state, "hard", {
    maxDepth: 6,
    timeLimitMs: 250,
    randomMoveChance: 0,
  });
  const nodesPerSecond = Math.round(
    (result.nodes * 1_000) / Math.max(1, result.elapsedMs),
  );

  console.log(name.toUpperCase());
  console.log(`  selected move: ${formatMove(result.move)}`);
  console.log(`  score: ${result.score}`);
  console.log(`  completed depth: ${result.depthReached}`);
  console.log(`  nodes searched: ${result.nodes}`);
  console.log(`  elapsed: ${result.elapsedMs} ms`);
  console.log(`  nodes/second: ${nodesPerSecond}`);
  console.log(`  transposition-table hits: ${result.transpositionTableHits}`);
  console.log(`  cutoffs: ${result.cutoffs}`);
  console.log(`  principal variation: ${formatLine(result.principalVariation)}`);
  console.log(`  timed out: ${result.timedOut}`);
  console.log("");
}
