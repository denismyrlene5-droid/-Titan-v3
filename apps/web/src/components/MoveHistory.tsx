import type { HistoryEntry } from "../game/types.ts";

interface MoveHistoryProps {
  readonly entries: readonly HistoryEntry[];
  readonly result?: string;
}

export function MoveHistory({ entries, result }: MoveHistoryProps) {
  return (
    <section className="history-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Game record</span>
          <h2>Move history</h2>
        </div>
        <span className="move-count">{entries.length}</span>
      </div>
      <div className="history-list">
        {entries.length === 0 ? (
          <p className="empty-state">The opening move is waiting.</p>
        ) : (
          entries.map((entry) => (
            <article className="history-row" key={entry.ply}>
              <span className="history-number">
                {Math.ceil(entry.ply / 2)}{entry.player === 2 ? "…" : "."}
              </span>
              <span className={`history-side player-${entry.player}`} />
              <span className="history-notation">{entry.notation}</span>
              <span className="history-tags">
                {entry.captures > 0 && (
                  <span title={`${entry.captures} captured`}>
                    ×{entry.captures}
                  </span>
                )}
                {entry.promoted && <span title="Promoted">♛</span>}
              </span>
            </article>
          ))
        )}
        {result && <p className="history-result">{result}</p>}
      </div>
    </section>
  );
}
