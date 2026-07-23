export { chooseMove } from "./choose-move.ts";
export {
  DIFFICULTY_CONFIGS,
  resolveAIConfig,
  type DifficultyConfig,
} from "./difficulty.ts";
export {
  DEFAULT_EVALUATION_WEIGHTS,
  LOSS_SCORE,
  WIN_SCORE,
  createHandcraftedEvaluator,
  evaluatePosition,
} from "./evaluate.ts";
export { moveKey, movesEqual, orderMoves } from "./move-ordering.ts";
export { searchPosition } from "./search.ts";
export {
  TranspositionTable,
  type StoredTransposition,
  type TranspositionBound,
  type TranspositionEntry,
} from "./transposition-table.ts";
export type {
  AIConfig,
  Difficulty,
  EvaluationWeights,
  PositionEvaluator,
  SearchResult,
} from "./types.ts";
