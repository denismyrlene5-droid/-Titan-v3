import { useState } from "react";
import { useDialogFocus } from "../components/useDialogFocus.ts";

interface MenuScreenProps {
  readonly onNew: () => void;
  readonly onHuman: () => void;
  readonly onComputer: () => void;
  readonly sound: boolean;
  readonly onSound: () => void;
}

export function MenuScreen(props: MenuScreenProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  useDialogFocus(settingsOpen, () => setSettingsOpen(false));
  return (
    <main className="menu-screen">
      <div className="menu-atmosphere" aria-hidden="true" />
      <section className="menu-card">
        <div className="brand-mark" aria-hidden="true">
          T<span>3</span>
        </div>
        <span className="eyebrow">The Ghana draughts arena</span>
        <h1>TITAN <em>V3</em></h1>
        <p className="menu-lead">
          Precision rules. Real captures. Built for the serious board.
        </p>
        <button className="primary-action" type="button" onClick={props.onNew}>
          New game <span>→</span>
        </button>
        <div className="menu-grid">
          <button type="button" onClick={props.onHuman}>
            <span className="menu-icon">Ⅱ</span>
            <span><strong>Human vs Human</strong><small>Local match</small></span>
          </button>
          <button type="button" onClick={props.onComputer}>
            <span className="menu-icon">◇</span>
            <span><strong>Human vs Computer</strong><small>Basic opponent</small></span>
          </button>
          <button type="button" disabled>
            <span className="menu-icon">△</span>
            <span><strong>Training Mode</strong><small>Coming soon</small></span>
          </button>
          <button type="button" onClick={() => setSettingsOpen(true)}>
            <span className="menu-icon">⚙</span>
            <span><strong>Settings</strong><small>Board & sound</small></span>
          </button>
        </div>
      </section>
      <p className="phase-label">Phase 2 · Playable web game</p>
      {settingsOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setSettingsOpen(false)}>
          <section
            className="modal-card settings-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="menu-settings-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" type="button" aria-label="Close settings" onClick={() => setSettingsOpen(false)}>×</button>
            <span className="eyebrow">Preferences</span>
            <h2 id="menu-settings-title">Settings</h2>
            <button type="button" onClick={props.onSound}>
              Sound <strong>{props.sound ? "On" : "Off"}</strong>
            </button>
            <p>Board orientation and piece style can be selected before each match.</p>
          </section>
        </div>
      )}
    </main>
  );
}
