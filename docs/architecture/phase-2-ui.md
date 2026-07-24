# Phase 2 UI architecture

Phase 2 keeps three kinds of state independent:

- `packages/game-engine` owns board state, legal moves, validation, rule
  application, promotion, and terminal detection.
- `apps/web/src/game/controller.ts` owns UI interaction state: selected piece,
  chosen path prefix, history, draw offers, and results.
- `apps/web/src/game/match.ts` owns scores, draws, rounds, and the target score.

## Guided multi-capture interaction

The rules engine returns each complete legal capture sequence as one `Move`.
The controller treats the user's taps as a prefix of those canonical paths.
For each tap it filters the engine moves by that prefix and exposes only their
next landing squares. It does not mutate the engine position or end the turn
until a complete path is selected. The final move is passed through
`validateMove` and `applyMove`.

This gives players step-by-step capture guidance while keeping continuation,
branching, promotion, and flying-king decisions in the rules engine.

## Phase 3 computer integration

`computer.ts` is the UI boundary for Titan search requests and responses. The
browser passes the current immutable `BoardState` and selected difficulty to a
module Web Worker, which calls the public Phase 3 `chooseMove` API. Returned
moves are applied through the Phase 2 controller and therefore through Phase 1
validation and state transitions.

Each request carries a generation and official position hash. Restart, rematch,
new-game, and menu actions terminate the worker and invalidate that generation.
The response is checked again inside the React state update, so a delayed
result cannot be applied to a newer session even when the newer board happens
to have the same initial position hash.

## Rendering

The board derives visual orientation independently of engine coordinates.
During a capture sequence, it renders a preview from the canonical move path;
the underlying engine board remains unchanged until the full move is applied.
Components receive interaction data through the controller and contain no
movement rules.
