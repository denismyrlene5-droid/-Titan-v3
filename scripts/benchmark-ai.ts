import { createInitialState } from "../packages/game-engine/src/index.ts";
import type { Move } from "../packages/game-engine/src/index.ts";
import {
  DIFFICULTY_CONFIGS,
  chooseMove,
} from "../packages/titan-ai/src/index.ts";
import type { Difficulty } from "../packages/titan-ai/src/index.ts";

const DIFFICULTIES: readonly Difficulty[] = [
  "easy",
  "medium",
  "hard",
  "master",
  "titan",
];

const BENCHMARK_TIME_LIMITS: Readonly<Record<Difficulty, number>> = {
  easy: 100,
  medium: 250,
  hard: 500,
  master: 750,
  titan: 1_000,
};

function formatMove(move: Move | null): string {
  if (!move) return "(none)";
  const separator = move.capturedPieceIds.length > 0 ? "x" : "-";
  return `${move.from}${separator}${move.path.join(separator)}`;
}

function formatLine(line: readonly Move[]): string {
  return line.map(formatMove).join(" ");
}

const state = createInitialState();
console.log("Titan V3 Phase 3 AI benchmark");
console.log(`Position: initial (${state.positionHash.length}-character hash)`);
console.log("");

for (const difficulty of DIFFICULTIES) {
  const result = chooseMove(state, difficulty, {
    timeLimitMs: BENCHMARK_TIME_LIMITS[difficulty],
    random: () => 0.5,
  });
  const nodesPerSecond = Math.round(
    (result.nodes * 1_000) / Math.max(1, result.elapsedMs),
  );

  console.log(`${difficulty.toUpperCase()}`);
  console.log(`  configured max depth: ${DIFFICULTY_CONFIGS[difficulty].maxDepth}`);
  console.log(`  chosen move: ${formatMove(result.move)}`);
  console.log(`  depth reached: ${result.depthReached}`);
  console.log(`  nodes searched: ${result.nodes}`);
  console.log(`  elapsed: ${result.elapsedMs} ms`);
  console.log(`  nodes/second: ${nodesPerSecond}`);
  console.log(`  evaluation: ${result.score}`);
  console.log(`  principal variation: ${formatLine(result.principalVariation)}`);
  console.log(`  timed out: ${result.timedOut}`);
  console.log("");
}
