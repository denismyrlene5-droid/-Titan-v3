import type {
  BoardState,
  Move,
  Player,
} from "../../../../packages/game-engine/src/index.ts";

export type OpponentType = "human" | "computer";
export type PieceAppearance = "gold" | "ivory" | "ruby";
export type BoardOrientation = "player1" | "player2";
export type AiDifficulty = "Easy" | "Medium" | "Hard";
export type GameStatus = "playing" | "finished";
export type ResultReason =
  | "no_pieces"
  | "one_piece_remaining"
  | "no_legal_moves"
  | "resignation"
  | "draw_agreement";

export interface GameOptions {
  readonly playerName: string;
  readonly opponentName: string;
  readonly opponentType: OpponentType;
  readonly humanSide: Player;
  readonly pieceAppearance: PieceAppearance;
  readonly orientation: BoardOrientation;
  readonly aiDifficulty: AiDifficulty;
  readonly matchTarget: number;
}

export interface GameResult {
  readonly winner?: Player;
  readonly reason: ResultReason;
}

export interface HistoryEntry {
  readonly ply: number;
  readonly player: Player;
  readonly from: number;
  readonly path: readonly number[];
  readonly captures: number;
  readonly capturedPieceIds: readonly string[];
  readonly promoted: boolean;
  readonly notation: string;
}

export interface GameSession {
  readonly initialState: BoardState;
  readonly board: BoardState;
  readonly options: GameOptions;
  readonly selectedPieceId?: string;
  readonly pathPrefix: readonly number[];
  readonly lastMove?: Move;
  readonly history: readonly HistoryEntry[];
  readonly status: GameStatus;
  readonly result?: GameResult;
  readonly drawOfferedBy?: Player;
}

export interface InteractionView {
  readonly legalMoves: readonly Move[];
  readonly selectablePieceIds: ReadonlySet<string>;
  readonly destinations: ReadonlySet<number>;
  readonly captureRequired: boolean;
  readonly selectedPieceId?: string;
  readonly pathPrefix: readonly number[];
}

export interface MatchState {
  readonly target: number;
  readonly player1Score: number;
  readonly player2Score: number;
  readonly draws: number;
  readonly round: number;
  readonly winner?: Player;
}
