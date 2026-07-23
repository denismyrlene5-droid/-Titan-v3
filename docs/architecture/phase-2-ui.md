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

## Temporary computer

`computer.ts` is a replaceable Phase 2 policy. It selects only from
`getLegalMoves`, preferring the greatest number of captured pieces. Its draw
policy is isolated beside its move policy. It contains no search, evaluation,
or Phase 3 AI behavior.

## Rendering

The board derives visual orientation independently of engine coordinates.
During a capture sequence, it renders a preview from the canonical move path;
the underlying engine board remains unchanged until the full move is applied.
Components receive interaction data through the controller and contain no
movement rules.
