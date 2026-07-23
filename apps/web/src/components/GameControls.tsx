interface GameControlsProps {
  readonly sound: boolean;
  readonly onNew: () => void;
  readonly onRestart: () => void;
  readonly onResign: () => void;
  readonly onDraw: () => void;
  readonly onFlip: () => void;
  readonly onSound: () => void;
  readonly onSettings: () => void;
}

export function GameControls(props: GameControlsProps) {
  return (
    <section className="controls-panel">
      <button type="button" onClick={props.onNew}>＋ New game</button>
      <button type="button" onClick={props.onRestart}>↻ Restart</button>
      <button type="button" onClick={props.onDraw}>½ Request draw</button>
      <button type="button" onClick={props.onFlip}>⇅ Flip board</button>
      <button type="button" onClick={props.onSound}>
        {props.sound ? "◉ Sound on" : "○ Sound off"}
      </button>
      <button type="button" onClick={props.onSettings}>⚙ Settings</button>
      <button type="button" className="danger-control" onClick={props.onResign}>
        ⚑ Accept defeat
      </button>
    </section>
  );
}
