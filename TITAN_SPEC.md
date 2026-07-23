# TITAN V3 — MASTER PRODUCT & ENGINEERING SPECIFICATION

**Project name:** Titan V3  
**Product type:** Browser-based Ghana Draughts AI, training platform, and future video-analysis system  
**Primary repository:** `denismyrlene5-droid/-Titan-v3`  
**Status:** Master specification  
**Purpose:** This document is the source of truth for all implementation work. Codex and every future developer should read this file before changing game rules, AI behavior, user experience, training logic, or the roadmap.

---

## 1. Product Vision

Titan V3 is a serious Ghana draughts platform built for competitive play, strong AI opposition, coaching, tactical study, post-game analysis, personalized improvement, and future video-based game recognition.

Titan must not feel like a basic checkers app. It should behave like a specialist Ghana draughts system that understands local rules, tactical patterns, traps, crown routes, forced captures, and practical play.

The long-term goal is to make Titan the strongest and most useful digital Ghana draughts platform available.

---

## 2. Core Product Principles

1. Correct Ghana draughts rules come first.
2. The AI must be genuinely challenging.
3. Training explanations must be understandable.
4. The board must be easy to use on both phone and desktop.
5. Features should be built in stages and tested before expansion.
6. The project must remain maintainable and modular.
7. Every move, hint, and analysis result must come from the same rules engine.
8. No user-facing feature may bypass compulsory capture logic.
9. Titan difficulty must come from stronger search and evaluation, not cheating.
10. The video analyzer must eventually recognize pieces by shape and appearance, not fixed colors.

---

## 3. Ghana Draughts Rules

### 3.1 Board

- Use a standard 10 × 10 draughts board.
- Only playable dark squares are used.
- Each player starts with 20 pieces.
- The initial setup must match the Ghana draughts arrangement confirmed by the user.
- Board orientation must remain consistent across Human vs AI, Human vs Human, Training, Puzzle, Analysis, and Video Analyzer modes.
- The game engine must store board coordinates independently of visual orientation.

### 3.2 Piece Types

Each side has men and kings, also called crowns.

A man promotes when it reaches the opponent’s crown row.

### 3.3 Normal Movement

#### Men

- Men move diagonally forward by one playable square.
- Direction depends on the player’s side.

#### Kings

- Kings are flying kings.
- A king may move any number of empty squares diagonally.
- A king may move both forward and backward.
- A king must stop on a legal empty square.

### 3.4 Capturing

Capturing is compulsory.

If at least one legal capture exists:

- Normal moves are forbidden.
- The player must make a capture.
- The interface must highlight only legal capturing pieces and destinations.
- The AI must never choose a non-capturing move.

#### Men

- Men capture diagonally.
- Men must be able to capture backward where Ghana draughts rules require it.
- The move generator must prevent the same piece from being captured twice in one sequence.

#### Kings

- Kings capture over distance.
- A king may cross empty diagonal squares before the captured piece.
- The first opponent piece encountered on that diagonal may be captured if at least one empty landing square exists beyond it.
- The king may land on any legal empty square beyond the captured piece, subject to continuation rules.
- Kings may capture forward and backward.

### 3.5 Multi-Capture

Multi-capture is compulsory.

After a capture:

- If the same piece has another legal capture, the turn continues.
- The player cannot end the turn early.
- The interface must keep the same piece selected during the sequence.
- Only legal continuation squares should be shown.
- The engine must return the entire capture path, captured pieces, and landing squares.

The system must correctly handle:

- Man multi-captures
- King multi-captures
- Direction changes during the sequence
- Backward captures
- Long-range king landings
- Promotion during or after a capture sequence
- Branching capture paths

### 3.6 Capture Priority

The implementation must support configurable Ghana draughts capture-priority rules.

The move generator should be designed to support:

- Mandatory capture with any capturing piece
- Maximum-capture rule, if required
- Tie-breaking between equal capture counts
- King-priority or piece-value priority, if required

All rule choices must be centralized in a `RuleConfig`, not scattered through the interface.

```ts
interface RuleConfig {
  boardSize: 10;
  piecesPerSide: 20;
  mandatoryCapture: true;
  menCaptureBackward: true;
  flyingKings: true;
  requireMaximumCapture: boolean;
  promotionTiming: "immediate" | "end_of_turn";
  onePieceRemainingMeansLoss: true;
}
```

### 3.7 Promotion

A man becomes a king when it reaches the opponent’s crown row.

Promotion timing must be handled consistently:

- If promotion is immediate, the piece may continue the same capture sequence as a king.
- If promotion happens after the sequence, it continues as a man and promotes at turn end.

This must be settled through Ghana draughts rule confirmation and tested with dedicated positions.

### 3.8 Win and Loss Conditions

A player loses when:

- They have no legal move.
- They have no pieces.
- They are left with only one piece, according to the user’s confirmed Ghana draughts rule.
- They resign or press **Accept Defeat**.

A player wins when the opponent meets any loss condition.

A game may end in a draw when:

- Both players agree to a draw request.
- A configured repetition condition is met.
- A configured no-progress move limit is reached.
- Tournament rules define another valid draw condition.

### 3.9 Draw Request

A player may request a draw.

- The opponent must explicitly accept or reject.
- Against AI, the AI should evaluate whether accepting is reasonable.
- The AI should consider material balance, position evaluation, winning chances, search result, repetition risk, and difficulty level.

### 3.10 Undo

- No undo in normal competitive games.
- Undo is allowed only in Training Mode.
- Training undo must restore the board state, side to move, capture-chain state, clocks, move history, evaluation, and hint state.

---

## 4. Game Modes

### 4.1 Human vs AI

Options:

- Player name
- Piece color
- Board orientation
- AI difficulty
- Time control
- Match format
- Coaching assistance
- Sound
- Animation speed

### 4.2 Human vs Human

Local two-player mode, with future support for online multiplayer, private rooms, spectator mode, tournaments, and ratings.

### 4.3 Training Mode

Training Mode is not simply an easier game.

It should provide:

- Best-move hints
- Explanation of threats
- Warnings before mistakes
- Undo
- Try-again option
- Crown-route guidance
- Trap alerts
- Tactical alternatives
- Evaluation changes
- Post-position lessons

Training Mode must never give weak or random hints.

### 4.4 Puzzle Mode

Puzzle categories:

- Forced capture
- Multi-capture
- King tactics
- Trap escape
- Crown race
- Sacrifice
- Endgame
- Best defense
- Winning sequence
- Avoiding a blunder

Each puzzle should include a starting position, side to move, goal, correct line, alternatives, explanation, difficulty, and tags.

### 4.5 Analysis Mode

Users can set up a board manually, import a game, step through moves, ask Titan for the best move, compare alternatives, view evaluation, see tactical warnings, and export the position.

### 4.6 Match Mode

- Up to five rounds or a configurable series
- First player to the target number of wins is the match winner
- Score examples: 5–2, 5–1, 5–4

The interface should show current game number, match score, draws, player names, side colors, and who starts next.

---

## 5. AI Difficulty System

Difficulty levels:

1. Easy
2. Medium
3. Hard
4. Master
5. Titan

### 5.1 Easy

- Shallow search
- Sometimes chooses suboptimal legal moves
- Still respects compulsory capture

### 5.2 Medium

- Basic tactical awareness
- Avoids one-move blunders
- Uses limited search
- Understands simple crown races

### 5.3 Hard

- Deeper search
- Strong capture-sequence calculation
- Basic trap recognition
- Better endgames
- Punishes common mistakes

### 5.4 Master

- Advanced search
- Strong evaluation
- Tactical extensions
- Better move ordering
- Stronger trap setup and prevention
- Serious challenge for experienced players

### 5.5 Titan

Titan must be the strongest level.

It should:

- Search deeply
- Use iterative deepening
- Use transposition tables
- Use alpha-beta pruning
- Detect forced captures accurately
- Extend tactical lines
- Understand traps
- Plan crown routes
- Punish weak moves
- Avoid simplistic material-only play
- Handle kings strongly
- Recognize sacrifices
- Improve endgame play
- Use time intelligently
- Return a move quickly in obvious positions
- Think longer only when the position requires it

Titan must not take excessive time on trivial moves.

---

## 6. AI Architecture

### 6.1 Search

Recommended starting architecture:

- Negamax or minimax
- Alpha-beta pruning
- Iterative deepening
- Transposition table
- Zobrist hashing
- Move ordering
- Quiescence or tactical extension
- Principal variation tracking
- Time-based search control
- Optional aspiration windows

### 6.2 Move Ordering

Priority order:

1. Forced captures
2. Longer capture sequences, where applicable
3. Winning captures
4. Promotion moves
5. Tactical threats
6. Killer moves
7. History heuristic
8. Principal variation move
9. Quiet positional moves

### 6.3 Evaluation Function

The evaluation function should include more than piece count.

Suggested terms:

- Man count
- King count
- Piece advancement
- Promotion distance
- Mobility
- Forced mobility
- Center control
- Edge safety
- Back-rank structure
- Capture threats
- Vulnerable pieces
- Protected pieces
- Connected formations
- Trapped pieces
- Tempo
- King activity
- Crown-route access
- Promotion potential
- Sacrifice compensation
- Multi-capture risk
- Opponent forced replies
- Endgame-specific terms

```text
score =
  material
  + kingValue
  + advancement
  + mobility
  + centerControl
  + formationStrength
  + crownRoutePotential
  + tacticalThreats
  - hangingPieces
  - trapRisk
  - forcedCaptureExposure
```

Weights should vary by game phase.

### 6.4 Game Phases

Detect opening, middlegame, and endgame.

#### Opening

- Development
- Formation safety
- Avoiding early traps
- Center influence

#### Middlegame

- Tactical calculation
- Capture threats
- Sacrifices
- Crown routes
- Space and mobility

#### Endgame

- King activity
- Opposition
- Forced capture geometry
- Promotion races
- Draw detection
- One-piece-loss condition

### 6.5 Trap Detection

Titan must detect immediate tactical traps, forced-capture traps, sacrifice traps, crown-route traps, king confinement, and multi-move setup traps.

Each trap detector should return the trap type, threatened piece, trigger move, best defense, severity, and explanation.

### 6.6 Crown Route Planning

The engine should estimate distance to promotion, safe route, blocked route, forced-capture interference, opponent interception, sacrifice opportunities, and best crown square.

### 6.7 Endgame Database

Future enhancement:

- Build or import tablebases for reduced-piece positions.
- Use exact win/draw/loss results when available.
- Store distance-to-conversion or distance-to-win.

### 6.8 AI Learning

Titan should not claim to learn unless it stores and uses data.

Long-term learning may include a game database, self-play, evaluation tuning, opening book, mistake tracking, user weakness profiles, reinforcement learning, and a neural evaluation model.

Initial versions should use deterministic search and evaluation first.

---

## 7. Coaching System

### 7.1 Coaching Levels

- Medium Coach
- Hard Coach
- Master Coach
- Titan Coach

Higher coaching levels should give stronger and more detailed guidance.

### 7.2 Hint Types

- Best move
- Good alternative
- Capture warning
- Trap warning
- Crown-route hint
- Defensive move
- Sacrifice idea
- Endgame plan
- Why this move?
- What happens if I play here?

### 7.3 Hint Quality

Hints must come from real engine analysis.

Each hint should include the recommended move, evaluation, main reason, principal variation, danger avoided, and visual arrows or highlights.

Avoid:

- Suggesting a move that loses immediately
- Ignoring compulsory capture
- Giving vague advice unrelated to the position
- Recommending only the first legal move
- Highlighting stale squares after the move

### 7.4 Interactive Lessons

Lessons should teach board basics, movement, compulsory capture, multi-capture, flying kings, promotion, traps, crown routes, sacrifices, endgames, and match strategy.

Lessons should include interactive positions, not just text.

### 7.5 Personalized Training

Track missed captures, frequent blunders, weak king play, poor crown routes, trap vulnerability, opening mistakes, endgame errors, overuse of edge squares, and failure to punish mistakes.

Then recommend lessons and puzzles.

---

## 8. Post-Game Analysis

After each game, show:

- Result
- Match score
- Move accuracy
- Best moves
- Mistakes
- Blunders
- Missed wins
- Missed captures
- Trap opportunities
- Crown-route mistakes
- Critical turning point
- Suggested lessons
- Replay

Each move should include move number, played move, best move, evaluation before, evaluation after, evaluation loss, explanation, and alternative line.

---

## 9. User Interface

### 9.1 General Style

The product should feel modern, clean, fast, competitive, understandable, and mobile friendly.

Avoid tiny center panels, crowded controls, persistent stale highlights, confusing move prompts, excessive popups, and unclear turn indicators.

### 9.2 Main Game Screen

#### Desktop

- Left panel: player and match information
- Center: large board
- Right panel: moves, hints, evaluation, controls

#### Mobile

- Player panel above board
- Board fills most of screen width
- Collapsible bottom sheet for moves and coaching
- Large tap targets

### 9.3 Board Interaction

The board must show selected piece, legal moves, forced captures, current continuation, last move, king status, turn indicator, and optional coordinates.

Highlights must clear correctly after every move.

### 9.4 Piece Customization

Allow piece color selection, board theme selection, player names, sound, animation speed, and reduced-motion mode.

The game engine must never depend on display colors.

### 9.5 Animations

Include smooth piece movement, capture animation, multi-capture sequence animation, promotion animation, win animation, hint arrows, evaluation transitions, and board setup animation.

Animations must never delay game logic or cause desynchronization.

---

## 10. Video Analyzer

### 10.1 Purpose

The future Titan Video Analyzer should analyze recorded or live Ghana draughts games.

It should detect the board, detect pieces, track moves, reconstruct positions, identify players, send positions to Titan, produce post-game analysis, and create a dataset for stronger AI.

### 10.2 Source Channels

Reference channels supplied by the user:

- `@botwedraughtsclub8031`
- `@Play_2333`

These may be useful for rule examples, position datasets, move-sequence extraction, tactical pattern research, and visual recognition testing.

Any use of external video content must respect copyright and platform rules.

### 10.3 Piece Recognition

Do not assume fixed blue and white pieces.

Initial practical solution:

1. Detect all piece-like objects.
2. Group pieces into Player 1 and Player 2 using appearance.
3. Add a quick calibration step.
4. Ask the user to click one sample piece for each side.
5. Track those visual groups through the video.

Long-term solution:

- Train an object detector to recognize men, kings, board squares, and hand occlusion.
- Recognize pieces by shape, texture, and appearance rather than color alone.

### 10.4 Video Analyzer Pipeline

1. Upload video or connect camera
2. Detect board corners
3. Correct perspective
4. Map playable squares
5. Detect pieces
6. Classify sides
7. Detect kings
8. Track motion
9. Infer legal move
10. Resolve occlusion
11. Validate against game rules
12. Store reconstructed game
13. Analyze with Titan
14. Export report

### 10.5 Calibration

- Click board corners if auto-detection fails
- Click one sample piece for Player 1
- Click one sample piece for Player 2
- Confirm king appearance
- Preview detected squares
- Start tracking

### 10.6 Live Analyzer

Future live mode may include camera capture, real-time board overlay, move detection, illegal-move alerts, evaluation, commentary, and match recording.

This should come only after uploaded-video analysis is stable.

---

## 11. Technical Architecture

### 11.1 Recommended Stack

Frontend:

- React
- TypeScript
- Vite or Next.js
- CSS Modules, Tailwind, or a consistent component system

Game engine:

- TypeScript initially for browser integration
- Optional Rust/WebAssembly later for stronger search

Backend, when needed:

- Node.js or Python
- PostgreSQL
- Object storage for videos
- Background workers for analysis

### 11.2 Repository Structure

```text
/
├── README.md
├── TITAN_SPEC.md
├── package.json
├── apps/
│   ├── web/
│   └── api/
├── packages/
│   ├── game-engine/
│   ├── titan-ai/
│   ├── coaching/
│   ├── analysis/
│   ├── ui/
│   └── shared/
├── tests/
│   ├── rules/
│   ├── ai/
│   ├── ui/
│   └── regression/
├── docs/
│   ├── rules/
│   ├── architecture/
│   ├── roadmap/
│   └── testing/
└── tools/
```

### 11.3 Core Data Models

```ts
type Player = 1 | 2;
type PieceKind = "man" | "king";

interface Piece {
  id: string;
  player: Player;
  kind: PieceKind;
  square: number;
}

interface BoardState {
  pieces: Piece[];
  sideToMove: Player;
  forcedPieceId?: string;
  moveNumber: number;
  halfMoveClock: number;
  positionHash: string;
}

interface Move {
  pieceId: string;
  from: number;
  path: number[];
  capturedPieceIds: string[];
  promotes: boolean;
}

interface GameRecord {
  id: string;
  initialState: BoardState;
  moves: Move[];
  result?: GameResult;
}
```

### 11.4 Rules Engine API

```ts
getLegalMoves(state: BoardState, config: RuleConfig): Move[]
applyMove(state: BoardState, move: Move, config: RuleConfig): BoardState
isTerminal(state: BoardState, config: RuleConfig): TerminalResult | null
validateMove(state: BoardState, move: Move, config: RuleConfig): ValidationResult
generateCaptures(state: BoardState, pieceId: string, config: RuleConfig): Move[]
```

The interface must never calculate legal moves independently.

---

## 12. Testing Requirements

### 12.1 Rules Tests

Create tests for:

- Initial setup
- Normal man movement
- King movement
- Mandatory capture
- Backward man capture
- Flying king capture
- Multi-capture
- Branching captures
- Promotion
- Promotion during capture
- One-piece loss
- No-legal-move loss
- Draw agreement
- Repetition
- Invalid move rejection

### 12.2 Regression Tests

Every previously reported bug must become a regression test.

Known bugs include:

- Wrong starting arrangement
- AI fails to capture
- Compulsory capture not enforced
- Only one capture allowed when more are required
- Freeze before final winning capture
- Highlight colors remain after a move
- King captures only one piece instead of continuing
- Prompt still says capture after turn ended
- King backward capture missing
- AI spends too long on obvious moves
- Titan misses simple tactics
- Titan fails to punish mistakes
- Titan gives weak training hints
- Board center or game area too small
- Move from highlighted circle to wrong destination
- Promotion or crown continuation errors

### 12.3 AI Tests

Use fixed tactical positions to test best capture, forced win, avoiding immediate loss, promotion race, trap detection, sacrifice, king multi-capture, endgame conversion, draw recognition, and time control.

### 12.4 UI Tests

Test mobile touch, desktop mouse, forced-capture highlighting, multi-capture continuation, undo in training only, color customization, orientation, match scoring, draw requests, resignation, and post-game replay.

---

## 13. Performance Targets

- Legal move generation should feel instant.
- Easy and Medium should respond quickly.
- Hard should usually respond within a few seconds.
- Master and Titan should use configurable time limits.
- Trivial forced moves should return immediately.
- The interface must remain responsive during AI search.
- Search should run in a Web Worker or separate process.
- Video analysis should use background jobs.

---

## 14. Accessibility

Include keyboard navigation, large tap targets, high-contrast mode, reduced motion, screen-reader labels, color-independent highlights, text status labels, and adjustable board size.

---

## 15. Security and Fair Play

Future online mode should include server-authoritative moves, match integrity checks, rate limiting, authentication, secure sessions, anti-cheat signals, replay audit, and abuse reporting.

Do not expose private user data in public game records.

---

## 16. Development Phases

### Phase 1 — Stable Rules Engine

Build:

- Board model
- Initial setup
- Legal movement
- Mandatory capture
- Multi-capture
- Kings
- Promotion
- Win/loss
- Tests

Exit condition:

- All rule tests pass
- All known capture bugs have regression tests

### Phase 2 — Playable Web Game

Build:

- Board UI
- Human vs Human
- Human vs basic AI
- Move history
- Match score
- Resign
- Draw request
- Mobile layout
- Piece customization

Exit condition:

- A complete match can be played without rule or UI failure

### Phase 3 — Strong Titan AI

Build:

- Iterative deepening
- Alpha-beta
- Transposition table
- Evaluation
- Move ordering
- Tactical extensions
- Difficulty levels
- Time management

Exit condition:

- Titan consistently beats weaker internal levels
- Tactical test suite passes

### Phase 4 — Coaching and Analysis

Build hints, explanations, training undo, mistake detection, post-game analysis, replay, crown-route visualizer, and trap explanations.

### Phase 5 — Lessons and Puzzles

Build interactive lessons, daily puzzles, personalized training, and a user skill profile.

### Phase 6 — Accounts and Online Features

Build accounts, saved games, cloud progress, online multiplayer, ratings, and tournaments.

### Phase 7 — Video Analyzer

Build uploaded-video analysis, board calibration, piece grouping, move reconstruction, and analysis reports.

### Phase 8 — Live Analyzer and Advanced AI

Build live camera support, object detection, self-play, neural evaluation, tablebases, and a mobile app.

---

## 17. Codex Working Instructions

Codex must:

1. Read `TITAN_SPEC.md` before making changes.
2. Inspect existing code before replacing anything.
3. Not change Ghana draughts rules without updating tests and documentation.
4. Build in small, reviewable commits.
5. Add tests for every bug fix.
6. Keep UI logic separate from rule logic.
7. Never hard-code piece colors into recognition or game logic.
8. Keep AI difficulty settings configurable.
9. Explain major architectural decisions in `/docs`.
10. Prefer a stable working feature over many unfinished features.
11. Run tests before committing.
12. Never claim a feature is complete if tests do not cover it.
13. Preserve backward compatibility where practical.
14. Ask for clarification only when the specification is genuinely ambiguous.
15. Treat this specification as the product source of truth.

---

## 18. First Codex Task

Paste this into Codex after adding this file to the repository:

> Open the repository `denismyrlene5-droid/-Titan-v3`. Read `TITAN_SPEC.md` completely and inspect the current repository. Create a development plan based on the existing code. Then implement Phase 1: a fully tested Ghana draughts rules engine with a 10×10 board, 20 pieces per side, compulsory captures, backward captures for men, flying kings, multi-capture sequences, promotion, legal move validation, and the one-piece-remaining loss rule. Keep rule logic separate from the UI. Add regression tests for the known capture and king bugs. Commit the work in small logical commits.

---

## 19. Open Questions Requiring Final Confirmation

These points must be confirmed through user testing or authoritative Ghana draughts rules:

- Whether maximum-capture length is always compulsory
- Tie-breaking when multiple maximum capture sequences exist
- Exact promotion timing during a capture sequence
- Draw by repetition count
- No-progress draw limit
- Whether any special king-capture priority exists
- Exact opening orientation in visual coordinates

Until confirmed, implement these through centralized configuration and document the current default.

---

## 20. Definition of Done

Titan V3 is successful when:

- Ghana draughts rules are correct.
- Captures never break.
- Kings behave correctly.
- Titan is genuinely difficult.
- Training advice is useful.
- The board works smoothly on phones and desktops.
- Post-game analysis teaches the player something.
- The architecture supports future video analysis.
- Every major bug is protected by a regression test.
- Codex can continue development using this document without losing the product vision.

---

**End of master specification**
