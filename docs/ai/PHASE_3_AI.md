# Phase 3 search AI

Phase 3 introduces Titan's first serious search opponent. It is a synchronous,
framework-independent TypeScript package under `packages/titan-ai`. The package
does not contain Ghana draughts move generation or state-transition rules.

## Correctness boundary

The Phase 1 engine remains authoritative:

- every root and search move comes from `getLegalMoves`;
- every successor position comes from `applyMove`;
- terminal results come from `isTerminal`;
- rule variants are supplied through the shared `RuleConfig`;
- search treats `BoardState` and its pieces as immutable values.

The evaluator examines board geometry for positional features, but those
features never create, accept, reject, or modify a move.

## Search architecture

`chooseMove` resolves a difficulty profile and runs iterative deepening. Each
completed iteration uses minimax with alpha-beta pruning and root-relative
scores. The search retains only the result from the last fully completed
iteration.

The search includes:

- terminal scores of `1_000_000 - ply` for wins and `-1_000_000 + ply` for
  losses, preferring faster wins and delaying forced losses;
- engine-validated move ordering for immediate wins, captures, capture length,
  promotions, kings, a transposition-table move, and advancement;
- principal-variation propagation;
- capture-only quiescence at Hard, Master, and Titan;
- a configurable quiescence limit;
- timeout checks at nodes and between moves;
- an always-legal root fallback if the first iteration cannot finish.

Search diagnostics are returned in `SearchResult`: chosen move, score, completed
depth, node count, elapsed milliseconds, principal variation, and timeout
status.

## Difficulty settings

| Level | Max depth | Time | Random move chance | Quiescence | Table |
| --- | ---: | ---: | ---: | --- | --- |
| Easy | 1 | 100 ms | 45% | No | No |
| Medium | 3 | 500 ms | 15% | No | Yes |
| Hard | 5 | 1,500 ms | 0% | Yes | Yes |
| Master | 7 | 3,500 ms | 0% | Yes | Yes |
| Titan | 10 | 7,000 ms | 0% | Yes | Yes |

Every value can be overridden with `Partial<AIConfig>`. Easy and Medium may
select another move from the legal engine list. A caller can inject
`random: () => number` for repeatable tests. Hard, Master, and Titan have no
random move selection.

## Handcrafted evaluation

All default weights live in `DEFAULT_EVALUATION_WEIGHTS`. Scores compare the
player with the opponent using:

- men and kings;
- legal mobility and king mobility;
- available captures and longest capture sequence;
- protected and vulnerable pieces;
- advancement and distance toward promotion;
- immediate promotion opportunities;
- centre control and edge safety;
- blocked pieces and opponent capture threats;
- immediate terminal danger;
- the configured one-piece-remaining loss rule.

`PositionEvaluator` is the integration seam for a future trained evaluator:

```ts
interface PositionEvaluator {
  evaluate(
    state: BoardState,
    perspective: Player,
    rules: RuleConfig,
  ): number;
}
```

Callers may provide an alternative implementation through `AIConfig.evaluator`.
Phase 3 ships only the handcrafted implementation.

## Transposition table

`TranspositionTable` keys entries with the engine's `positionHash` plus the
root perspective. Each entry records depth, score, exact/lower/upper bound,
best move, and search generation.

The default capacity is 100,000 entries. On reaching the configured limit, the
table removes the oldest and shallowest records until it is at 75% capacity.
A caller may reuse one table across `chooseMove` calls. Reuse should keep the
same rules and evaluator settings because cached scores belong to that search
configuration.

## Timeout behaviour

Timeout is cooperative and checked throughout normal and quiescence search.
An interrupted iteration is discarded. The result reports the move, score, and
principal variation from the last completed depth. If no depth completes, the
result still contains a canonical legal fallback and reports depth zero.

`AIConfig.now` can be replaced by a deterministic clock for timeout tests.

## Verification and benchmark

```sh
npm test
npm run test:engine
npm run test:ai
npm run typecheck
npm run benchmark:ai
```

The benchmark searches the initial position at every difficulty and prints the
move, completed depth, nodes, elapsed time, nodes per second, evaluation, and
principal variation. Its shorter benchmark time budgets are deliberately
different from gameplay defaults.

## Known limitations

- Search currently runs synchronously; the browser integration should put it in
  a Web Worker.
- The evaluator is handcrafted and not yet tuned from Ghana draughts games.
- The engine does not yet expose repetition or no-progress draw adjudication.
- There is no opening book, endgame tablebase, aspiration window, killer
  heuristic, history heuristic, or parallel search.
- Principal variations recovered directly from an exact cached entry may
  contain only its stored best move.
- A time limit is cooperative, so a single engine operation can finish just
  after its deadline.
- Titan is a strong first search version, not a claim of complete or unbeatable
  play.

## Future dataset integration

Dataset collection and trained evaluation are deferred to Phase 4 by the Phase
3 brief. A future model can implement `PositionEvaluator` and replace or blend
with the handcrafted score without changing legal move generation, search
state transitions, or the UI. Phase 3 adds no machine-learning dependencies.

