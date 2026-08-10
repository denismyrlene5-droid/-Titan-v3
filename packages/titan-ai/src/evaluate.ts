import {
  coordinateToSquare,
  createState,
  generatePieceMoves,
  getLegalMoves,
  isTerminal,
  squareToCoordinate,
} from "../../game-engine/src/index.ts";
import type {
  BoardState,
  Move,
  Piece,
  Player,
  RuleConfig,
} from "../../game-engine/src/index.ts";
import type {
  EvaluationWeights,
  PositionEvaluator,
} from "./types.ts";

export const WIN_SCORE = 1_000_000;
export const LOSS_SCORE = -WIN_SCORE;

export const DEFAULT_EVALUATION_WEIGHTS: EvaluationWeights = Object.freeze({
  man: 100,
  king: 320,
  mobility: 4,
  captureAvailable: 25,
  capturedPiecePotential: 40,
  promotionDistance: 6,
  promotionThreat: 45,
  centreControl: 8,
  edgeSafety: 3,
  protectedPiece: 10,
  vulnerablePiece: -18,
  blockedPiece: -12,
  kingMobility: 6,
  backRankGuard: 7,
  initiative: 5,
  opponentThreat: -20,
  immediateLossDanger: -250_000,
  onePieceDanger: -500_000,
});

interface PlayerFeatures {
  readonly men: number;
  readonly kings: number;
  readonly mobility: number;
  readonly captureMoves: number;
  readonly longestCapture: number;
  readonly advancement: number;
  readonly promotionThreats: number;
  readonly centrePieces: number;
  readonly edgePieces: number;
  readonly protectedPieces: number;
  readonly vulnerablePieces: number;
  readonly blockedPieces: number;
  readonly kingMobility: number;
  readonly backRankGuard: number;
  readonly initiative: number;
  readonly opponentThreats: number;
  readonly immediateLoss: number;
  readonly onePieceDanger: number;
}

function stateForPlayer(state: BoardState, player: Player): BoardState {
  if (state.sideToMove === player && state.forcedPieceId === undefined) {
    return state;
  }
  return createState(state.pieces, player, {
    moveNumber: state.moveNumber,
    halfMoveClock: state.halfMoveClock,
  });
}

function promotionDistance(piece: Piece): number {
  const { row } = squareToCoordinate(piece.square);
  return piece.player === 1 ? row : 9 - row;
}

function isCentreSquare(square: number): boolean {
  const { row, column } = squareToCoordinate(square);
  return row >= 3 && row <= 6 && column >= 3 && column <= 6;
}

function isEdgeSquare(square: number): boolean {
  const { column } = squareToCoordinate(square);
  return column === 0 || column === 9;
}

function diagonalNeighbourSquares(piece: Piece): readonly number[] {
  const { row, column } = squareToCoordinate(piece.square);
  const neighbours: number[] = [];

  for (const rowOffset of [-1, 1]) {
    for (const columnOffset of [-1, 1]) {
      const square = coordinateToSquare(
        row + rowOffset,
        column + columnOffset,
      );
      if (square !== null) neighbours.push(square);
    }
  }
  return neighbours;
}

function pieceMoves(
  playerState: BoardState,
  piece: Piece,
  rules: RuleConfig,
): readonly Move[] {
  return generatePieceMoves(playerState, piece.id, rules);
}

function collectFeatures(
  state: BoardState,
  player: Player,
  rules: RuleConfig,
  playerState: BoardState,
  legalMoves: readonly Move[],
  opponentLegalMoves: readonly Move[],
): PlayerFeatures {
  const pieces = state.pieces.filter((piece) => piece.player === player);
  const occupiedByPlayer = new Set(pieces.map((piece) => piece.square));
  const captures = legalMoves.filter(
    (move) => move.capturedPieceIds.length > 0,
  );
  const opponentCaptures = opponentLegalMoves.filter(
    (move) => move.capturedPieceIds.length > 0,
  );
  const threatenedIds = new Set(
    opponentCaptures.flatMap((move) => move.capturedPieceIds),
  );
  let blockedPieces = 0;
  let kingMobility = 0;

  for (const candidate of pieces) {
    const moves = pieceMoves(playerState, candidate, rules);
    if (moves.length === 0) blockedPieces += 1;
    if (candidate.kind === "king") kingMobility += moves.length;
  }

  const terminal = isTerminal(playerState, rules);
  return {
    men: pieces.filter((piece) => piece.kind === "man").length,
    kings: pieces.filter((piece) => piece.kind === "king").length,
    mobility: legalMoves.length,
    captureMoves: captures.length,
    longestCapture: captures.reduce(
      (longest, move) => Math.max(longest, move.capturedPieceIds.length),
      0,
    ),
    advancement: pieces
      .filter((piece) => piece.kind === "man")
      .reduce((total, piece) => total + (9 - promotionDistance(piece)), 0),
    promotionThreats: legalMoves.filter((move) => move.promotes).length,
    centrePieces: pieces.filter((piece) => isCentreSquare(piece.square)).length,
    edgePieces: pieces.filter((piece) => isEdgeSquare(piece.square)).length,
    protectedPieces: pieces.filter((piece) =>
      diagonalNeighbourSquares(piece).some((square) =>
        occupiedByPlayer.has(square),
      ),
    ).length,
    vulnerablePieces: pieces.filter((piece) => threatenedIds.has(piece.id))
      .length,
    blockedPieces,
    kingMobility,
    backRankGuard: pieces.filter((piece) =>
      piece.kind === "man" &&
      squareToCoordinate(piece.square).row === (player === 1 ? 9 : 0),
    ).length,
    initiative: state.sideToMove === player ? 1 : 0,
    opponentThreats: opponentCaptures.reduce(
      (total, move) => total + move.capturedPieceIds.length,
      0,
    ),
    immediateLoss: terminal ? 1 : 0,
    onePieceDanger:
      rules.onePieceRemainingMeansLoss && pieces.length === 1 ? 1 : 0,
  };
}

function weightedFeatures(
  features: PlayerFeatures,
  weights: EvaluationWeights,
): number {
  return (
    features.men * weights.man +
    features.kings * weights.king +
    features.mobility * weights.mobility +
    (features.captureMoves > 0 ? weights.captureAvailable : 0) +
    features.longestCapture * weights.capturedPiecePotential +
    features.advancement * weights.promotionDistance +
    features.promotionThreats * weights.promotionThreat +
    features.centrePieces * weights.centreControl +
    features.edgePieces * weights.edgeSafety +
    features.protectedPieces * weights.protectedPiece +
    features.vulnerablePieces * weights.vulnerablePiece +
    features.blockedPieces * weights.blockedPiece +
    features.kingMobility * weights.kingMobility +
    features.backRankGuard * weights.backRankGuard +
    features.initiative * weights.initiative +
    features.opponentThreats * weights.opponentThreat +
    features.immediateLoss * weights.immediateLossDanger +
    features.onePieceDanger * weights.onePieceDanger
  );
}

export function evaluatePosition(
  state: BoardState,
  perspective: Player,
  rules: RuleConfig,
  weights: EvaluationWeights = DEFAULT_EVALUATION_WEIGHTS,
): number {
  const other: Player = perspective === 1 ? 2 : 1;
  const ownCount = state.pieces.filter(
    (piece) => piece.player === perspective,
  ).length;
  const otherCount = state.pieces.filter((piece) => piece.player === other).length;
  const losingCount = rules.onePieceRemainingMeansLoss ? 1 : 0;
  if (ownCount <= losingCount) return LOSS_SCORE;
  if (otherCount <= losingCount) return WIN_SCORE;
  const terminal = isTerminal(state, rules);
  if (terminal) {
    return terminal.winner === perspective ? WIN_SCORE : LOSS_SCORE;
  }

  const ownState = stateForPlayer(state, perspective);
  const otherState = stateForPlayer(state, other);
  const ownMoves = getLegalMoves(ownState, rules);
  const otherMoves = getLegalMoves(otherState, rules);
  const own = collectFeatures(
    state,
    perspective,
    rules,
    ownState,
    ownMoves,
    otherMoves,
  );
  const theirs = collectFeatures(
    state,
    other,
    rules,
    otherState,
    otherMoves,
    ownMoves,
  );
  return weightedFeatures(own, weights) - weightedFeatures(theirs, weights);
}

export function createHandcraftedEvaluator(
  weights: EvaluationWeights = DEFAULT_EVALUATION_WEIGHTS,
): PositionEvaluator {
  return Object.freeze({
    evaluate(
      state: BoardState,
      perspective: Player,
      rules: RuleConfig,
    ): number {
      return evaluatePosition(state, perspective, rules, weights);
    },
  });
}
