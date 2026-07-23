import type {
  BoardState,
  Move,
  Player,
  RuleConfig,
} from "../../game-engine/src/index.ts";
import type { TranspositionTable } from "./transposition-table.ts";

export type Difficulty = "easy" | "medium" | "hard" | "master" | "titan";

export interface EvaluationWeights {
  readonly man: number;
  readonly king: number;
  readonly mobility: number;
  readonly captureAvailable: number;
  readonly capturedPiecePotential: number;
  readonly promotionDistance: number;
  readonly promotionThreat: number;
  readonly centreControl: number;
  readonly edgeSafety: number;
  readonly protectedPiece: number;
  readonly vulnerablePiece: number;
  readonly blockedPiece: number;
  readonly kingMobility: number;
  readonly opponentThreat: number;
  readonly immediateLossDanger: number;
  readonly onePieceDanger: number;
}

export interface PositionEvaluator {
  evaluate(
    state: BoardState,
    perspective: Player,
    rules: RuleConfig,
  ): number;
}

export interface AIConfig {
  readonly maxDepth: number;
  readonly timeLimitMs: number;
  readonly randomMoveChance: number;
  readonly useQuiescence: boolean;
  readonly maxQuiescenceDepth: number;
  readonly useTranspositionTable: boolean;
  readonly transpositionTableMaxSize: number;
  readonly rules: RuleConfig;
  readonly evaluationWeights: EvaluationWeights;
  readonly evaluator: PositionEvaluator;
  readonly transpositionTable?: TranspositionTable;
  readonly random: () => number;
  readonly now: () => number;
}

export interface SearchResult {
  move: Move | null;
  score: number;
  depthReached: number;
  nodes: number;
  elapsedMs: number;
  principalVariation: readonly Move[];
  timedOut: boolean;
}

