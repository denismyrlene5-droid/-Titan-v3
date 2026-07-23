import type { BoardState, Piece, Player, RuleConfig } from "./types.ts";

export const BOARD_SIZE = 10;
export const PLAYABLE_SQUARES = 50;

export const DEFAULT_RULE_CONFIG: RuleConfig = Object.freeze({
  boardSize: 10,
  piecesPerSide: 20,
  mandatoryCapture: true,
  menCaptureBackward: true,
  flyingKings: true,
  requireMaximumCapture: false,
  promotionTiming: "immediate",
  onePieceRemainingMeansLoss: true,
});

export function isPlayableCoordinate(row: number, column: number): boolean {
  return (
    Number.isInteger(row) &&
    Number.isInteger(column) &&
    row >= 0 &&
    row < BOARD_SIZE &&
    column >= 0 &&
    column < BOARD_SIZE &&
    (row + column) % 2 === 1
  );
}

export function coordinateToSquare(row: number, column: number): number | null {
  if (!isPlayableCoordinate(row, column)) return null;
  return row * 5 + Math.floor(column / 2);
}

export function squareToCoordinate(
  square: number,
): { row: number; column: number } {
  if (!Number.isInteger(square) || square < 0 || square >= PLAYABLE_SQUARES) {
    throw new RangeError(`Square must be an integer from 0 to 49: ${square}`);
  }

  const row = Math.floor(square / 5);
  const index = square % 5;
  const column = index * 2 + (row % 2 === 0 ? 1 : 0);
  return { row, column };
}

export function opponent(player: Player): Player {
  return player === 1 ? 2 : 1;
}

export function crownRow(player: Player): number {
  return player === 1 ? 0 : 9;
}

export function forwardDirection(player: Player): -1 | 1 {
  return player === 1 ? -1 : 1;
}

export function isCrownSquare(square: number, player: Player): boolean {
  return squareToCoordinate(square).row === crownRow(player);
}

export function hashPosition(
  pieces: readonly Piece[],
  sideToMove: Player,
): string {
  const serialized = [...pieces]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(
      (piece) =>
        `${piece.id}:${piece.player}:${piece.kind === "king" ? "k" : "m"}:${piece.square}`,
    )
    .join("|");
  return `${sideToMove};${serialized}`;
}

export function createInitialState(): BoardState {
  const pieces: Piece[] = [];

  for (let square = 0; square < 20; square += 1) {
    pieces.push({
      id: `p2-${square + 1}`,
      player: 2,
      kind: "man",
      square,
    });
  }

  for (let square = 30; square < 50; square += 1) {
    pieces.push({
      id: `p1-${square - 29}`,
      player: 1,
      kind: "man",
      square,
    });
  }

  return Object.freeze({
    pieces: Object.freeze(pieces),
    sideToMove: 1,
    moveNumber: 1,
    halfMoveClock: 0,
    positionHash: hashPosition(pieces, 1),
  });
}

export function createState(
  pieces: readonly Piece[],
  sideToMove: Player = 1,
  overrides: Partial<
    Pick<BoardState, "forcedPieceId" | "moveNumber" | "halfMoveClock">
  > = {},
): BoardState {
  const ids = new Set<string>();
  const squares = new Set<number>();

  for (const piece of pieces) {
    if (ids.has(piece.id)) throw new Error(`Duplicate piece id: ${piece.id}`);
    if (squares.has(piece.square)) {
      throw new Error(`More than one piece on square ${piece.square}`);
    }
    squareToCoordinate(piece.square);
    ids.add(piece.id);
    squares.add(piece.square);
  }

  const cloned = pieces.map((piece) => Object.freeze({ ...piece }));
  return Object.freeze({
    pieces: Object.freeze(cloned),
    sideToMove,
    ...(overrides.forcedPieceId
      ? { forcedPieceId: overrides.forcedPieceId }
      : {}),
    moveNumber: overrides.moveNumber ?? 1,
    halfMoveClock: overrides.halfMoveClock ?? 0,
    positionHash: hashPosition(cloned, sideToMove),
  });
}
