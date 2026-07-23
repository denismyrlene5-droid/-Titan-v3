# Titan V3

Titan V3 is a competitive Ghana draughts engine and training-platform project.
Phase 2 adds a responsive React interface around the fully tested Phase 1 rules
engine, and Phase 3 adds the first strong, search-based Titan opponent.

## Current features

- Complete 10x10 Ghana draughts rules engine with 20 pieces per side
- Compulsory and full multi-captures
- Backward captures for men and flying kings
- Promotion and the one-piece-remaining loss rule
- Human vs Human and Human vs Computer matches
- Responsive board interaction, match scoring, draws, resignation, and history
- Iterative-deepening minimax search with alpha-beta pruning
- Capture quiescence, move ordering, principal variations, and a bounded
  transposition table
- Easy, Medium, Hard, Master, and Titan difficulty profiles
- Automated engine, UI-controller, and AI regression coverage

The UI and AI never calculate or bypass move legality. Every selected move comes
from `getLegalMoves`, every completed move is checked by `validateMove`, and
every state transition uses `applyMove`.

## Requirements

- Node.js 24 or newer
- npm 10 or newer

## Install and run

```sh
npm install
npm run dev
```

Open the local URL printed by Vite.

## Use the AI

```ts
import { createInitialState } from "./packages/game-engine/src/index.ts";
import { chooseMove } from "./packages/titan-ai/src/index.ts";

const result = chooseMove(createInitialState(), "titan", {
  timeLimitMs: 2_000,
});

console.log(result.move);
console.log(result.depthReached, result.score, result.principalVariation);
```

`chooseMove` accepts `easy`, `medium`, `hard`, `master`, or `titan`. Settings
such as maximum depth, time limit, random move chance, quiescence, table size,
rules, evaluator, clock, and deterministic random source can be overridden.

## Run the tests

```sh
npm test
npm run test:engine
npm run test:phase2
npm run test:ai
npm run typecheck
```

## Run the benchmark

```sh
npm run benchmark:ai
```

The benchmark reports each difficulty's selected move, completed depth, nodes,
elapsed time, nodes per second, score, and principal variation.

## Production build

```sh
npm run build
```

The production site is written to `dist/`.

## Project layout

```text
apps/web/                   React + TypeScript + Vite interface
packages/game-engine/       Framework-independent Ghana draughts rules
packages/titan-ai/          Search, evaluation, difficulty, and diagnostics
scripts/benchmark-ai.ts     Repeatable command-line benchmark
tests/                      Engine, UI-controller, and tactical AI tests
docs/architecture/          Phase 2 architectural decisions
docs/ai/PHASE_3_AI.md       Phase 3 architecture and limitations
```

## Current limitations

Phase 3 search is synchronous and should be moved to a Web Worker before UI
integration. It has no opening book, tablebase, repetition adjudication, or
trained evaluator. Titan is a strong first search version, not a claim of
complete or unbeatable play.

Dataset collection and trained evaluation are deferred to Phase 4. The
`PositionEvaluator` interface allows a future model to replace or supplement
the centralized handcrafted evaluator without changing the rules engine.

The product requirements and rule decisions remain defined in
`TITAN_SPEC.md`.
