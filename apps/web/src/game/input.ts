import type { GameStatus } from "./types.ts";

interface GameInputState {
  readonly computerTurn: boolean;
  readonly thinking: boolean;
  readonly status: GameStatus;
}

export function shouldDisableGameInput({
  computerTurn,
  thinking,
  status,
}: GameInputState): boolean {
  return computerTurn || thinking || status === "finished";
}

export class ComputerActionGuard {
  #generation = 0;

  start(): number {
    this.#generation += 1;
    return this.#generation;
  }

  cancel(): void {
    this.#generation += 1;
  }

  isCurrent(generation: number): boolean {
    return generation === this.#generation;
  }
}
