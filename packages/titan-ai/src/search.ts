import {
  applyMove,
  getLegalMoves,
  isTerminal,
} from "../../game-engine/src/index.ts";
import type {
  BoardState,
  Move,
  Player,
  TerminalResult,
} from "../../game-engine/src/index.ts";
import { LOSS_SCORE, WIN_SCORE } from "./evaluate.ts";
import { movesEqual, orderMoves } from "./move-ordering.ts";
import { TranspositionTable } from "./transposition-table.ts";
import type {
  AIConfig,
  SearchResult,
} from "./types.ts";

const NEGATIVE_INFINITY = Number.NEGATIVE_INFINITY;
const POSITIVE_INFINITY = Number.POSITIVE_INFINITY;
const SEARCH_TIMEOUT = Symbol("search-timeout");

interface SearchContext {
  readonly rootPlayer: Player;
  readonly config: AIConfig;
  readonly table: TranspositionTable | null;
  readonly startedAt: number;
  readonly deadline: number;
  nodes: number;
  cutoffs: number;
}

interface NodeResult {
  readonly score: number;
  readonly principalVariation: readonly Move[];
}

function elapsed(context: SearchContext): number {
  return Math.max(0, context.config.now() - context.startedAt);
}

function checkTimeout(context: SearchContext): void {
  if (context.config.now() >= context.deadline) throw SEARCH_TIMEOUT;
}

function terminalScore(
  terminal: TerminalResult,
  perspective: Player,
  ply: number,
): number {
  return terminal.winner === perspective
    ? WIN_SCORE - ply
    : LOSS_SCORE + ply;
}

function evaluateLeaf(state: BoardState, context: SearchContext): number {
  return context.config.evaluator.evaluate(
    state,
    context.rootPlayer,
    context.config.rules,
  );
}

function evaluateQuiescenceLimit(
  state: BoardState,
  alpha: number,
  beta: number,
  ply: number,
  context: SearchContext,
): NodeResult {
  checkTimeout(context);
  context.nodes += 1;
  const terminal = isTerminal(state, context.config.rules);
  if (terminal) {
    return {
      score: terminalScore(terminal, context.rootPlayer, ply),
      principalVariation: [],
    };
  }

  const captures = getLegalMoves(state, context.config.rules).filter(
    (move) => move.capturedPieceIds.length > 0,
  );
  if (captures.length === 0) {
    return { score: evaluateLeaf(state, context), principalVariation: [] };
  }

  const maximizing = state.sideToMove === context.rootPlayer;
  let bestScore = maximizing ? NEGATIVE_INFINITY : POSITIVE_INFINITY;
  let bestLine: readonly Move[] = [];
  for (const move of orderMoves(state, captures, context.config.rules)) {
    const child = evaluateQuiescenceLimit(
      applyMove(state, move, context.config.rules),
      alpha,
      beta,
      ply + 1,
      context,
    );
    if (
      (maximizing && child.score > bestScore) ||
      (!maximizing && child.score < bestScore)
    ) {
      bestScore = child.score;
      bestLine = [move, ...child.principalVariation];
    }
    if (maximizing) {
      alpha = Math.max(alpha, bestScore);
    } else {
      beta = Math.min(beta, bestScore);
    }
    if (alpha >= beta) {
      context.cutoffs += 1;
      break;
    }
  }

  return { score: bestScore, principalVariation: bestLine };
}

function quiescence(
  state: BoardState,
  alpha: number,
  beta: number,
  ply: number,
  quiescenceDepth: number,
  context: SearchContext,
): NodeResult {
  checkTimeout(context);
  context.nodes += 1;

  const terminal = isTerminal(state, context.config.rules);
  if (terminal) {
    return {
      score: terminalScore(terminal, context.rootPlayer, ply),
      principalVariation: [],
    };
  }

  const legalMoves = getLegalMoves(state, context.config.rules);
  const captures = legalMoves.filter(
    (move) => move.capturedPieceIds.length > 0,
  );
  if (captures.length === 0) {
    return { score: evaluateLeaf(state, context), principalVariation: [] };
  }

  const maximizing = state.sideToMove === context.rootPlayer;
  let bestScore = maximizing ? NEGATIVE_INFINITY : POSITIVE_INFINITY;
  let bestLine: readonly Move[] = [];
  const ordered = orderMoves(state, captures, context.config.rules);

  for (const move of ordered) {
    checkTimeout(context);
    const childState = applyMove(state, move, context.config.rules);
    const child =
      quiescenceDepth >= context.config.maxQuiescenceDepth
        ? evaluateQuiescenceLimit(
            childState,
            alpha,
            beta,
            ply + 1,
            context,
          )
        : quiescence(
            childState,
            alpha,
            beta,
            ply + 1,
            quiescenceDepth + 1,
            context,
          );

    if (
      (maximizing && child.score > bestScore) ||
      (!maximizing && child.score < bestScore)
    ) {
      bestScore = child.score;
      bestLine = [move, ...child.principalVariation];
    }
    if (maximizing) {
      alpha = Math.max(alpha, bestScore);
    } else {
      beta = Math.min(beta, bestScore);
    }
    if (alpha >= beta) {
      context.cutoffs += 1;
      break;
    }
  }

  return { score: bestScore, principalVariation: bestLine };
}

function alphaBeta(
  state: BoardState,
  depth: number,
  alpha: number,
  beta: number,
  ply: number,
  context: SearchContext,
): NodeResult {
  checkTimeout(context);
  context.nodes += 1;

  const terminal = isTerminal(state, context.config.rules);
  if (terminal) {
    return {
      score: terminalScore(terminal, context.rootPlayer, ply),
      principalVariation: [],
    };
  }
  if (depth === 0) {
    if (context.config.useQuiescence) {
      return quiescence(state, alpha, beta, ply, 0, context);
    }
    return { score: evaluateLeaf(state, context), principalVariation: [] };
  }

  const legalMoves = getLegalMoves(state, context.config.rules);
  const cached = context.table?.probe(
    state.positionHash,
    context.rootPlayer,
    context.config.transpositionContextKey,
  );
  const cachedBestMove =
    cached?.bestMove === null || cached?.bestMove === undefined
      ? null
      : (legalMoves.find((move) => movesEqual(move, cached.bestMove)) ?? null);
  const usableCached =
    cached && cachedBestMove === null ? undefined : cached;
  const alphaOriginal = alpha;
  const betaOriginal = beta;
  if (usableCached && usableCached.depth >= depth) {
    if (usableCached.bound === "exact") {
      return {
        score: usableCached.score,
        principalVariation: cachedBestMove ? [cachedBestMove] : [],
      };
    }
    if (usableCached.bound === "lower") {
      alpha = Math.max(alpha, usableCached.score);
    }
    if (usableCached.bound === "upper") {
      beta = Math.min(beta, usableCached.score);
    }
    if (alpha >= beta) {
      context.cutoffs += 1;
      return {
        score: usableCached.score,
        principalVariation: cachedBestMove ? [cachedBestMove] : [],
      };
    }
  }

  const ordered = orderMoves(
    state,
    legalMoves,
    context.config.rules,
    cachedBestMove,
  );
  const maximizing = state.sideToMove === context.rootPlayer;
  let bestScore = maximizing ? NEGATIVE_INFINITY : POSITIVE_INFINITY;
  let bestMove: Move | null = null;
  let bestLine: readonly Move[] = [];

  for (const move of ordered) {
    checkTimeout(context);
    const child = alphaBeta(
      applyMove(state, move, context.config.rules),
      depth - 1,
      alpha,
      beta,
      ply + 1,
      context,
    );
    if (
      bestMove === null ||
      (maximizing && child.score > bestScore) ||
      (!maximizing && child.score < bestScore)
    ) {
      bestScore = child.score;
      bestMove = move;
      bestLine = [move, ...child.principalVariation];
    }
    if (maximizing) {
      alpha = Math.max(alpha, bestScore);
    } else {
      beta = Math.min(beta, bestScore);
    }
    if (alpha >= beta) {
      context.cutoffs += 1;
      break;
    }
  }

  context.table?.store({
    hash: state.positionHash,
    perspective: context.rootPlayer,
    contextKey: context.config.transpositionContextKey,
    depth,
    score: bestScore,
    bound:
      bestScore <= alphaOriginal
        ? "upper"
        : bestScore >= betaOriginal
          ? "lower"
          : "exact",
    bestMove,
  });
  return { score: bestScore, principalVariation: bestLine };
}

function fallbackScore(
  state: BoardState,
  move: Move,
  rootPlayer: Player,
  config: AIConfig,
): number {
  const next = applyMove(state, move, config.rules);
  const terminal = isTerminal(next, config.rules);
  return terminal
    ? terminalScore(terminal, rootPlayer, 1)
    : config.evaluator.evaluate(next, rootPlayer, config.rules);
}

export function searchPosition(
  state: BoardState,
  config: AIConfig,
): SearchResult {
  const startedAt = config.now();
  const rootPlayer = state.sideToMove;
  const terminal = isTerminal(state, config.rules);
  if (terminal) {
    return {
      move: null,
      score: terminalScore(terminal, rootPlayer, 0),
      depthReached: 0,
      nodes: 0,
      transpositionTableHits: 0,
      cutoffs: 0,
      elapsedMs: Math.max(0, config.now() - startedAt),
      principalVariation: [],
      timedOut: false,
    };
  }

  const legalMoves = getLegalMoves(state, config.rules);
  const fallback = legalMoves[0] ?? null;
  if (!fallback) {
    return {
      move: null,
      score: LOSS_SCORE,
      depthReached: 0,
      nodes: 0,
      transpositionTableHits: 0,
      cutoffs: 0,
      elapsedMs: Math.max(0, config.now() - startedAt),
      principalVariation: [],
      timedOut: false,
    };
  }
  if (legalMoves.length === 1 && config.timeLimitMs > 0) {
    return {
      move: fallback,
      score: fallbackScore(state, fallback, rootPlayer, config),
      depthReached: 1,
      nodes: 1,
      transpositionTableHits: 0,
      cutoffs: 0,
      elapsedMs: Math.max(0, config.now() - startedAt),
      principalVariation: [fallback],
      timedOut: false,
    };
  }

  let bestMove = fallback;
  let bestScore = 0;
  let bestLine: readonly Move[] = [fallback];
  let depthReached = 0;
  let timedOut = config.timeLimitMs <= 0;
  const table = config.useTranspositionTable
    ? (config.transpositionTable ??
      new TranspositionTable(config.transpositionTableMaxSize))
    : null;
  const tableHitsAtStart = table?.hits ?? 0;
  table?.beginSearch();
  const context: SearchContext = {
    rootPlayer,
    config,
    table,
    startedAt,
    deadline: startedAt + Math.max(0, config.timeLimitMs),
    nodes: 0,
    cutoffs: 0,
  };

  if (!timedOut) {
    for (let depth = 1; depth <= config.maxDepth; depth += 1) {
      try {
        const completed = alphaBeta(
          state,
          depth,
          NEGATIVE_INFINITY,
          POSITIVE_INFINITY,
          0,
          context,
        );
        if (completed.principalVariation[0]) {
          bestMove = completed.principalVariation[0];
          bestScore = completed.score;
          bestLine = completed.principalVariation;
        }
        depthReached = depth;
      } catch (error) {
        if (error !== SEARCH_TIMEOUT) throw error;
        timedOut = true;
        break;
      }
    }
  }

  return {
    move: bestMove,
    score: bestScore,
    depthReached,
    nodes: context.nodes,
    transpositionTableHits: (table?.hits ?? 0) - tableHitsAtStart,
    cutoffs: context.cutoffs,
    elapsedMs: elapsed(context),
    principalVariation: bestLine,
    timedOut,
  };
}
