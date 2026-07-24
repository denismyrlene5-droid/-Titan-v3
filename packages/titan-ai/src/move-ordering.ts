import {
  applyMove,
  isTerminal,
  squareToCoordinate,
} from "../../game-engine/src/index.ts";
import type {
  BoardState,
  Move,
  RuleConfig,
} from "../../game-engine/src/index.ts";

export interface OrderedMove {
  readonly move: Move;
  readonly childState: BoardState;
}

export function movesEqual(left: Move | null, right: Move | null): boolean {
  if (left === null || right === null) return left === right;
  return (
    left.pieceId === right.pieceId &&
    left.from === right.from &&
    left.promotes === right.promotes &&
    left.path.length === right.path.length &&
    left.path.every((square, index) => square === right.path[index]) &&
    left.capturedPieceIds.length === right.capturedPieceIds.length &&
    left.capturedPieceIds.every(
      (pieceId, index) => pieceId === right.capturedPieceIds[index],
    )
  );
}

export function moveKey(move: Move): string {
  return `${move.pieceId}:${move.from}:${move.path.join(",")}:${move.capturedPieceIds.join(",")}:${move.promotes ? 1 : 0}`;
}

function advancementScore(state: BoardState, move: Move): number {
  const piece = state.pieces.find((candidate) => candidate.id === move.pieceId);
  const destination = move.path.at(-1);
  if (!piece || piece.kind === "king" || destination === undefined) return 0;
  const fromRow = squareToCoordinate(move.from).row;
  const destinationRow = squareToCoordinate(destination).row;
  return piece.player === 1
    ? fromRow - destinationRow
    : destinationRow - fromRow;
}

function orderingScore(
  state: BoardState,
  move: Move,
  childState: BoardState,
  rules: RuleConfig,
  transpositionBest: Move | null,
): number {
  const movingPiece = state.pieces.find(
    (candidate) => candidate.id === move.pieceId,
  );
  const immediateWin =
    isTerminal(childState, rules)?.winner === state.sideToMove;

  return (
    (movesEqual(move, transpositionBest) ? 10_000_000_000 : 0) +
    (immediateWin ? 1_000_000_000 : 0) +
    (move.capturedPieceIds.length > 0 ? 100_000_000 : 0) +
    move.capturedPieceIds.length * 1_000_000 +
    (move.promotes ? 100_000 : 0) +
    (movingPiece?.kind === "king" ? 10_000 : 0) +
    advancementScore(state, move) * 100
  );
}

export function orderMovesWithChildren(
  state: BoardState,
  moves: readonly Move[],
  rules: RuleConfig,
  transpositionBest: Move | null = null,
  checkDeadline: () => void = () => {},
): OrderedMove[] {
  return moves
    .map((move, index) => {
      checkDeadline();
      const childState = applyMove(state, move, rules);
      return {
        move,
        childState,
        index,
        score: orderingScore(
          state,
          move,
          childState,
          rules,
          transpositionBest,
        ),
      };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ move, childState }) => ({ move, childState }));
}

export function orderMoves(
  state: BoardState,
  moves: readonly Move[],
  rules: RuleConfig,
  transpositionBest: Move | null = null,
  checkDeadline: () => void = () => {},
): Move[] {
  return orderMovesWithChildren(
    state,
    moves,
    rules,
    transpositionBest,
    checkDeadline,
  ).map(({ move }) => move);
}
