import type {
  BoardState,
} from "../../../../packages/game-engine/src/index.ts";
import type {
  Difficulty,
  SearchResult,
} from "../../../../packages/titan-ai/src/index.ts";
import { playCanonicalMove } from "./controller.ts";
import type { GameSession } from "./types.ts";

export interface ComputerSearchRequest {
  readonly requestId: number;
  readonly positionHash: string;
  readonly state: BoardState;
  readonly difficulty: Difficulty;
}

export interface ComputerSearchResponse {
  readonly requestId: number;
  readonly positionHash: string;
  readonly result: SearchResult;
}

export function isComputerTurn(session: GameSession): boolean {
  return (
    session.options.opponentType === "computer" &&
    session.status === "playing" &&
    session.board.sideToMove !== session.options.humanSide
  );
}

export function createComputerSearchRequest(
  session: GameSession,
  requestId: number,
): ComputerSearchRequest | null {
  if (!isComputerTurn(session)) return null;
  return Object.freeze({
    requestId,
    positionHash: session.board.positionHash,
    state: session.board,
    difficulty: session.options.aiDifficulty,
  });
}

export function applyComputerSearchResult(
  session: GameSession,
  expectedPositionHash: string,
  result: SearchResult,
): GameSession {
  if (
    !isComputerTurn(session) ||
    session.board.positionHash !== expectedPositionHash ||
    result.move === null
  ) {
    return session;
  }
  return playCanonicalMove(session, result.move);
}

function material(state: BoardState, player: 1 | 2): number {
  return state.pieces
    .filter((piece) => piece.player === player)
    .reduce((score, piece) => score + (piece.kind === "king" ? 2 : 1), 0);
}

export function acceptComputerDraw(state: BoardState): boolean {
  return Math.abs(material(state, 1) - material(state, 2)) <= 1;
}
