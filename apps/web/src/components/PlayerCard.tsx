import type { BoardState, Player } from "../../../../packages/game-engine/src/index.ts";

interface PlayerCardProps {
  readonly board: BoardState;
  readonly player: Player;
  readonly name: string;
  readonly active: boolean;
  readonly score: number;
}

export function PlayerCard({
  board,
  player,
  name,
  active,
  score,
}: PlayerCardProps) {
  const pieces = board.pieces.filter((piece) => piece.player === player);
  const kings = pieces.filter((piece) => piece.kind === "king").length;
  return (
    <section className={`player-card ${active ? "active" : ""}`}>
      <div className={`player-token player-${player}`} aria-hidden="true" />
      <div className="player-card-copy">
        <span className="eyebrow">Player {player}</span>
        <strong>{name}</strong>
        <small>
          {pieces.length} pieces · {kings} crowns
        </small>
      </div>
      <div className="score-badge" aria-label={`${score} match wins`}>
        {score}
      </div>
    </section>
  );
}
