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
- Threefold-repetition and 80-ply no-progress draw adjudication
- Synthesized move, capture, promotion, result, and interface sounds
- Iterative-deepening minimax search with alpha-beta pruning
- Capture quiescence, move ordering, principal variations, and a bounded
  transposition table
- Easy, Medium, Hard, Master, and Titan difficulty profiles
- Non-blocking browser search in a cancellable Web Worker
- Automated engine, UI-controller, and AI regression coverage

The UI and AI never calculate or bypass move legality. Every selected move comes
from `getLegalMoves`, every completed move is checked by `validateMove`, and
every state transition uses `applyMove`.

## Requirements

- Node.js 24 or newer
- npm 10 or newer

## Install and run

```sh
npm ci
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
console.log(result.searchedMove, result.randomized);
console.log(result.depthReached, result.score, result.principalVariation);
```

`chooseMove` accepts `easy`, `medium`, `hard`, `master`, or `titan`. Settings
such as maximum depth, time limit, random move chance, quiescence, table size,
rules, evaluator, clock, and deterministic random source can be overridden.
When a custom evaluator shares a transposition table across searches, provide a
stable `evaluatorCacheKey`. Without one, Titan safely isolates that evaluator's
entries instead of relying on JavaScript object identity.

The default Ghana rules require a capture but do not require the
maximum-length capture (`requireMaximumCapture: false`). Maximum-capture
filtering remains a centralized, opt-in rule because `TITAN_SPEC.md` leaves
that tournament-policy detail configurable.

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

The benchmark runs deterministic Hard search over seven representative
positions. It reports the selected move, score, completed depth, nodes, elapsed
time, nodes per second, transposition-table hits, cutoffs, principal variation,
and timeout status. Stabilization measurements are recorded in
`docs/ai/STABILIZATION_BENCHMARK.md`.

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

The framework-independent `chooseMove` API is synchronous, while the React app
runs it in a cancellable Web Worker so search does not block interaction.
Phase 3 has no opening book, tablebase, or trained evaluator. Titan is a strong
first search version, not a claim of complete or
unbeatable play.

The current draw defaults are three occurrences of the same position and 80
plies without a capture or promotion.

Dataset collection and trained evaluation are deferred to Phase 4. The
`PositionEvaluator` interface allows a future model to replace or supplement
the centralized handcrafted evaluator without changing the rules engine.

The product requirements and rule decisions remain defined in
`TITAN_SPEC.md`.
