import type { Move, Player } from "../../game-engine/src/index.ts";

export type TranspositionBound = "exact" | "lower" | "upper";

export interface TranspositionEntry {
  readonly hash: string;
  readonly perspective: Player;
  readonly depth: number;
  readonly score: number;
  readonly bound: TranspositionBound;
  readonly bestMove: Move | null;
  readonly generation: number;
}

export interface StoredTransposition {
  readonly hash: string;
  readonly perspective: Player;
  readonly depth: number;
  readonly score: number;
  readonly bound: TranspositionBound;
  readonly bestMove: Move | null;
}

function tableKey(hash: string, perspective: Player): string {
  return `${perspective}|${hash}`;
}

export class TranspositionTable {
  readonly maxSize: number;
  #entries = new Map<string, TranspositionEntry>();
  #generation = 0;
  #hits = 0;
  #probes = 0;

  constructor(maxSize = 100_000) {
    if (!Number.isInteger(maxSize) || maxSize < 1) {
      throw new RangeError("Transposition-table size must be a positive integer.");
    }
    this.maxSize = maxSize;
  }

  get size(): number {
    return this.#entries.size;
  }

  get generation(): number {
    return this.#generation;
  }

  get hits(): number {
    return this.#hits;
  }

  get probes(): number {
    return this.#probes;
  }

  beginSearch(): number {
    this.#generation += 1;
    return this.#generation;
  }

  probe(hash: string, perspective: Player): TranspositionEntry | undefined {
    this.#probes += 1;
    const entry = this.#entries.get(tableKey(hash, perspective));
    if (entry) this.#hits += 1;
    return entry;
  }

  peek(hash: string, perspective: Player): TranspositionEntry | undefined {
    return this.#entries.get(tableKey(hash, perspective));
  }

  store(value: StoredTransposition): void {
    const key = tableKey(value.hash, value.perspective);
    const current = this.#entries.get(key);
    if (
      current &&
      current.depth > value.depth &&
      current.generation === this.#generation
    ) {
      return;
    }

    if (!current && this.#entries.size >= this.maxSize) {
      this.#cleanup();
    }
    this.#entries.set(
      key,
      Object.freeze({
        ...value,
        generation: this.#generation,
      }),
    );
  }

  clear(): void {
    this.#entries.clear();
    this.#hits = 0;
    this.#probes = 0;
  }

  #cleanup(): void {
    const targetSize = Math.max(0, Math.floor(this.maxSize * 0.75));
    const oldest = [...this.#entries.entries()].sort(
      ([, left], [, right]) =>
        left.generation - right.generation || left.depth - right.depth,
    );
    for (const [key] of oldest) {
      if (this.#entries.size <= targetSize) break;
      this.#entries.delete(key);
    }
  }
}

