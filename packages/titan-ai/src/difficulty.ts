import { DEFAULT_RULE_CONFIG } from "../../game-engine/src/index.ts";
import {
  DEFAULT_EVALUATION_WEIGHTS,
  createHandcraftedEvaluator,
} from "./evaluate.ts";
import type { AIConfig, Difficulty } from "./types.ts";

export type DifficultyConfig = Pick<
  AIConfig,
  | "maxDepth"
  | "timeLimitMs"
  | "randomMoveChance"
  | "useQuiescence"
  | "useTranspositionTable"
>;

export const DIFFICULTY_CONFIGS: Readonly<
  Record<Difficulty, Readonly<DifficultyConfig>>
> = Object.freeze({
  easy: Object.freeze({
    maxDepth: 1,
    timeLimitMs: 100,
    randomMoveChance: 0.45,
    useQuiescence: false,
    useTranspositionTable: false,
  }),
  medium: Object.freeze({
    maxDepth: 3,
    timeLimitMs: 500,
    randomMoveChance: 0.15,
    useQuiescence: false,
    useTranspositionTable: true,
  }),
  hard: Object.freeze({
    maxDepth: 5,
    timeLimitMs: 1_500,
    randomMoveChance: 0,
    useQuiescence: true,
    useTranspositionTable: true,
  }),
  master: Object.freeze({
    maxDepth: 7,
    timeLimitMs: 3_500,
    randomMoveChance: 0,
    useQuiescence: true,
    useTranspositionTable: true,
  }),
  titan: Object.freeze({
    maxDepth: 10,
    timeLimitMs: 7_000,
    randomMoveChance: 0,
    useQuiescence: true,
    useTranspositionTable: true,
  }),
});

export function resolveAIConfig(
  difficulty: Difficulty,
  overrides: Partial<AIConfig> = {},
): AIConfig {
  const level = DIFFICULTY_CONFIGS[difficulty];
  const evaluationWeights =
    overrides.evaluationWeights ?? DEFAULT_EVALUATION_WEIGHTS;

  return {
    ...level,
    maxQuiescenceDepth: 8,
    transpositionTableMaxSize: 100_000,
    rules: DEFAULT_RULE_CONFIG,
    evaluationWeights,
    evaluator: createHandcraftedEvaluator(evaluationWeights),
    random: Math.random,
    now: Date.now,
    ...overrides,
  };
}
