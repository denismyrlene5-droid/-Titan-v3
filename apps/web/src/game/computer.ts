import {
  DEFAULT_RULE_CONFIG,
  getLegalMoves,
  type BoardState,
  type Move,
} from "../../../../packages/game-engine/src/index.ts";

export interface ComputerPolicy {
  chooseMove(state: BoardState): Move | undefined;
  acceptDraw(state: BoardState): boolean;
}

function material(state: BoardState, player: 1 | 2): number {
  return state.pieces
    .filter((piece) => piece.player === player)
    .reduce((score, piece) => score + (piece.kind === "king" ? 2 : 1), 0);
}

export const basicComputerPolicy: ComputerPolicy = Object.freeze({
  chooseMove(state) {
    const moves = getLegalMoves(state, DEFAULT_RULE_CONFIG);
    if (moves.length === 0) return undefined;
    const maximumCaptures = Math.max(
      ...moves.map((move) => move.capturedPieceIds.length),
    );
    return moves.find(
      (move) => move.capturedPieceIds.length === maximumCaptures,
    );
  },
  acceptDraw(state) {
    return Math.abs(material(state, 1) - material(state, 2)) <= 1;
  },
});
