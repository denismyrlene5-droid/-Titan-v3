import type { GameResult, MatchState } from "./types.ts";

export function createMatch(target = 3): MatchState {
  return Object.freeze({
    target: Math.max(1, Math.min(9, target)),
    player1Score: 0,
    player2Score: 0,
    draws: 0,
    round: 1,
  });
}

export function recordGameResult(
  match: MatchState,
  result: GameResult,
): MatchState {
  if (match.winner) return match;
  const player1Score = match.player1Score + (result.winner === 1 ? 1 : 0);
  const player2Score = match.player2Score + (result.winner === 2 ? 1 : 0);
  const winner =
    player1Score >= match.target
      ? 1
      : player2Score >= match.target
        ? 2
        : undefined;
  return Object.freeze({
    ...match,
    player1Score,
    player2Score,
    draws: match.draws + (result.winner ? 0 : 1),
    round: match.round + 1,
    winner,
  });
}
