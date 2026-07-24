import { useState } from "react";
import type { GameOptions, OpponentType } from "../game/types.ts";
import { DEFAULT_GAME_OPTIONS } from "../game/controller.ts";

interface SetupScreenProps {
  readonly initialOpponent: OpponentType;
  readonly onBack: () => void;
  readonly onStart: (options: GameOptions) => void;
}

export function SetupScreen({
  initialOpponent,
  onBack,
  onStart,
}: SetupScreenProps) {
  const [options, setOptions] = useState<GameOptions>({
    ...DEFAULT_GAME_OPTIONS,
    opponentType: initialOpponent,
    opponentName: initialOpponent === "computer" ? "Titan V3" : "Player 2",
  });
  const update = <Key extends keyof GameOptions>(
    key: Key,
    value: GameOptions[Key],
  ) => setOptions((current) => ({ ...current, [key]: value }));

  return (
    <main className="setup-screen">
      <section className="setup-card">
        <button className="back-button" type="button" onClick={onBack}>← Menu</button>
        <span className="eyebrow">Match desk</span>
        <h1>Set the board</h1>
        <p>
          {options.opponentType === "computer"
            ? "Choose your side and match format. Rules stay exactly the same."
            : "Choose player names and match format. Rules stay exactly the same."}
        </p>
        <div className="setup-form">
          <label>
            <span>Your name</span>
            <input
              value={options.playerName}
              maxLength={24}
              onChange={(event) => update("playerName", event.target.value)}
            />
          </label>
          <label>
            <span>Opponent</span>
            <select
              value={options.opponentType}
              onChange={(event) => {
                const value = event.target.value as OpponentType;
                update("opponentType", value);
                update(
                  "opponentName",
                  value === "computer" ? "Titan V3" : "Player 2",
                );
              }}
            >
              <option value="human">Human</option>
              <option value="computer">Computer</option>
            </select>
          </label>
          <label>
            <span>Opponent name</span>
            <input
              value={options.opponentName}
              disabled={options.opponentType === "computer"}
              maxLength={24}
              onChange={(event) => update("opponentName", event.target.value)}
            />
          </label>
          {options.opponentType === "computer" && (
            <fieldset>
              <legend>Your side</legend>
              <div className="segmented">
                <button
                  className={options.humanSide === 1 ? "chosen" : ""}
                  type="button"
                  onClick={() => update("humanSide", 1)}
                >Gold · first</button>
                <button
                  className={options.humanSide === 2 ? "chosen" : ""}
                  type="button"
                  onClick={() => update("humanSide", 2)}
                >Onyx · second</button>
              </div>
            </fieldset>
          )}
          <label>
            <span>Gold piece style</span>
            <select
              value={options.pieceAppearance}
              onChange={(event) =>
                update("pieceAppearance", event.target.value as GameOptions["pieceAppearance"])
              }
            >
              <option value="gold">Tournament gold</option>
              <option value="ivory">Classic ivory</option>
              <option value="ruby">Royal ruby</option>
            </select>
          </label>
          <label>
            <span>Board orientation</span>
            <select
              value={options.orientation}
              onChange={(event) =>
                update("orientation", event.target.value as GameOptions["orientation"])
              }
            >
              <option value="player1">Gold at bottom</option>
              <option value="player2">Onyx at bottom</option>
            </select>
          </label>
          <label>
            <span>Computer level</span>
            <select
              value={options.aiDifficulty}
              disabled={options.opponentType !== "computer"}
              onChange={(event) =>
                update("aiDifficulty", event.target.value as GameOptions["aiDifficulty"])
              }
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
              <option value="master">Master</option>
              <option value="titan">Titan</option>
            </select>
          </label>
          <label>
            <span>First to</span>
            <select
              value={options.matchTarget}
              onChange={(event) => update("matchTarget", Number(event.target.value))}
            >
              {[1, 2, 3, 5].map((target) => (
                <option value={target} key={target}>{target} win{target > 1 ? "s" : ""}</option>
              ))}
            </select>
          </label>
        </div>
        <button
          className="primary-action"
          type="button"
          disabled={!options.playerName.trim() || !options.opponentName.trim()}
          onClick={() => onStart({ ...options, playerName: options.playerName.trim() })}
        >
          Enter arena <span>→</span>
        </button>
      </section>
    </main>
  );
}
