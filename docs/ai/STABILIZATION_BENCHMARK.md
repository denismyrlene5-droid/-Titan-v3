# Phase 1–3 stabilization benchmark

These measurements compare `npm run benchmark:ai` immediately before and after
the Phase 3 stabilization changes on the same Windows host with Node.js 24.
Each position uses deterministic Hard search with a 250 ms maximum.

| Position | Before depth / nodes / time | After depth / nodes / time |
| --- | --- | --- |
| Opening | 2 / 435 / 251 ms | 3 / 465 / 250 ms |
| Compulsory capture | 1 / 1 / 0 ms | 1 / 1 / 0 ms |
| Branching multi-capture | 6 / 540 / 13 ms | 6 / 369 / 11 ms |
| King-heavy | 1 / 1 / 0 ms | 1 / 1 / 0 ms |
| Promotion race | 6 / 6,950 / 167 ms | 6 / 3,380 / 104 ms |
| Tactical trap | 6 / 2,894 / 147 ms | 6 / 1,496 / 111 ms |
| Endgame | 1 / 1 / 0 ms | 1 / 1 / 0 ms |

The opening now completes depth 3 within the same fixed budget. Full-depth
promotion and tactical searches also finish sooner. Node totals are not a
direct before/after work counter because stabilization intentionally corrected
quiescence's double-counted nodes; the after values represent unique visited
nodes.

Elapsed time varies with host load, so this is a regression baseline rather
than a cross-machine performance claim.
