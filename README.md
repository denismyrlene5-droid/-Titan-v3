# Titan V3

Titan V3 is a competitive browser-based Ghana draughts game. Phase 2 adds a
responsive React interface around the fully tested Phase 1 rules engine.

## Current features

- Human vs Human local matches
- Human vs Computer matches against a lightweight legal-move opponent
- 10×10 board with compulsory captures, guided multi-captures, flying kings,
  promotion, orientation reversal, and touch-friendly interaction
- Match targets, scoring, draws, resignation, rematches, and move history
- Gold, ivory, and ruby piece appearances
- Desktop three-column layout and compact mobile layout

The Phase 2 computer is intentionally simple: it chooses a legal engine move
and prefers the move with the most captures. Strong search and difficulty
levels belong to Phase 3.

## Requirements

- Node.js 24 or newer
- npm 10 or newer

## Install and run

```sh
npm install
npm run dev
```

Open the local URL printed by Vite.

## Run the tests

```sh
npm test
```

Run only one suite with `npm run test:engine` or `npm run test:phase2`.

## Production build

```sh
npm run build
```

The production site is written to `dist/`.

## Project layout

```text
apps/web/                  React + TypeScript + Vite interface
packages/game-engine/      Framework-independent Ghana draughts rules
tests/                     Engine regression and Phase 2 integration tests
docs/architecture/         Architectural decisions
```

UI components never calculate move legality. They read canonical moves from
the game engine and submit completed moves back through the engine validator.

The product requirements and rule decisions are defined in `TITAN_SPEC.md`.
