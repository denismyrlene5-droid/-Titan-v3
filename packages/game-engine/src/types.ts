export type Player = 1 | 2;
export type PieceKind = "man" | "king";
export type PromotionTiming = "immediate" | "end_of_turn";

export interface Piece {
  readonly id: string;
  readonly player: Player;
  readonly kind: PieceKind;
  readonly square: number;
}

export interface BoardState {
  readonly pieces: readonly Piece[];
  readonly sideToMove: Player;
  readonly forcedPieceId?: string;
  readonly moveNumber: number;
  readonly halfMoveClock: number;
  readonly positionHash: string;
}

export interface Move {
  readonly pieceId: string;
  readonly from: number;
  /** Every landing square in order. A quiet move has one entry. */
  readonly path: readonly number[];
  /** Captures in the same order as the capture landings in path. */
  readonly capturedPieceIds: readonly string[];
  readonly promotes: boolean;
}

export interface RuleConfig {
  readonly boardSize: 10;
  readonly piecesPerSide: 20;
  readonly mandatoryCapture: boolean;
  readonly menCaptureBackward: boolean;
  readonly flyingKings: boolean;
  readonly requireMaximumCapture: boolean;
  readonly promotionTiming: PromotionTiming;
  readonly onePieceRemainingMeansLoss: boolean;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly reason?: string;
  readonly canonicalMove?: Move;
}

export type TerminalReason =
  | "no_pieces"
  | "one_piece_remaining"
  | "no_legal_moves";

export interface TerminalResult {
  readonly winner: Player;
  readonly loser: Player;
  readonly reason: TerminalReason;
}
