import {
  applyMove,
  getLegalMoves,
  isTerminal,
} from "../../game-engine/src/index.ts";
import type { BoardState } from "../../game-engine/src/index.ts";
import { resolveAIConfig } from "./difficulty.ts";
import { LOSS_SCORE, WIN_SCORE } from "./evaluate.ts";
import { movesEqual } from "./move-ordering.ts";
import { searchPosition } from "./search.ts";
import type {
  AIConfig,
  Difficulty,
  SearchResult,
} from "./types.ts";

export function chooseMove(
  state: BoardState,
  difficulty: Difficulty,
  config: Partial<AIConfig> = {},
): SearchResult {
  const resolved = resolveAIConfig(difficulty, config);
  const result = searchPosition(state, resolved);
  if (
    result.move === null ||
    resolved.randomMoveChance <= 0 ||
    resolved.random() >= resolved.randomMoveChance
  ) {
    return result;
  }

  const legalMoves = getLegalMoves(state, resolved.rules);
  if (legalMoves.length < 2) return result;
  const randomIndex = Math.min(
    legalMoves.length - 1,
    Math.floor(Math.max(0, resolved.random()) * legalMoves.length),
  );
  const selected = legalMoves[randomIndex] ?? result.move;
  if (movesEqual(selected, result.move)) return result;

  const next = applyMove(state, selected, resolved.rules);
  const terminal = isTerminal(next, resolved.rules);
  const score = terminal
    ? terminal.winner === state.sideToMove
      ? WIN_SCORE - 1
      : LOSS_SCORE + 1
    : resolved.evaluator.evaluate(next, state.sideToMove, resolved.rules);
  return {
    ...result,
    move: selected,
    score,
    principalVariation: [selected],
  };
}

