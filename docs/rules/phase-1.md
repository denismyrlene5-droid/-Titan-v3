# Phase 1 rules decisions

`TITAN_SPEC.md` is the source of truth. This note records defaults only where
the specification explicitly leaves confirmation open.

## Coordinates and initial orientation

The engine numbers the 50 playable squares from `0` to `49`, left-to-right and
top-to-bottom across the playable squares:

- Player 2 begins on squares `0` through `19` and moves toward row 9.
- Player 1 begins on squares `30` through `49` and moves toward row 0.
- Player 1 moves first.

These are engine coordinates and do not constrain a future visual orientation.

## Configurable defaults

- Capturing is mandatory.
- Any complete capture sequence may be chosen by default.
- `requireMaximumCapture` enables longest-sequence priority.
- Men may capture backward.
- Kings are flying kings.
- Promotion is immediate by default. A man that reaches the crown row during a
  capture becomes a king and completes the sequence with king movement.
- `promotionTiming: "end_of_turn"` keeps the piece a man for the sequence and
  promotes it only if its final landing is on the crown row.
- A side with one piece remaining loses immediately.

The unresolved tie-breaking and special king-priority questions remain outside
the engine until their rules are confirmed. The move model and centralized
configuration leave room to add those policies without involving UI code.

## Capture model

A generated capture is always a complete turn. `Move.path` contains every
landing square, and `Move.capturedPieceIds` contains captures in order. A
partial path is not legal, so callers cannot stop a compulsory multi-capture
early.

Captured pieces are removed from the temporary board during sequence search.
This prevents recapturing the same piece while allowing the moving piece to
cross squares that became empty earlier in the sequence.

## Phase boundary

Phase 1 has no UI or AI. All future consumers must use `getLegalMoves`,
`validateMove`, and `applyMove`; they must not duplicate rule logic.
