import {
  coordinateToSquare,
  crownRow,
  forwardDirection,
  hashPosition,
  isCrownSquare,
  opponent,
  squareToCoordinate,
} from "./board.ts";
import type {
  BoardState,
  Move,
  Piece,
  Player,
  RuleConfig,
  TerminalResult,
  ValidationResult,
} from "./types.ts";

const DIAGONALS = Object.freeze([
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
] as const);

type PieceMap = Map<number, Piece>;

function pieceMap(pieces: readonly Piece[]): PieceMap {
  return new Map(pieces.map((piece) => [piece.square, piece]));
}

function matchingMove(left: Move, right: Move): boolean {
  return (
    left.pieceId === right.pieceId &&
    left.from === right.from &&
    left.promotes === right.promotes &&
    left.path.length === right.path.length &&
    left.path.every((square, index) => square === right.path[index]) &&
    left.capturedPieceIds.length === right.capturedPieceIds.length &&
    left.capturedPieceIds.every(
      (pieceId, index) => pieceId === right.capturedPieceIds[index],
    )
  );
}

function didPromote(
  original: Piece,
  kind: Piece["kind"],
  path: readonly number[],
  config: RuleConfig,
): boolean {
  if (original.kind === "king") return false;
  if (config.promotionTiming === "immediate") {
    return kind === "king" || path.some((square) => isCrownSquare(square, original.player));
  }
  const finalSquare = path.at(-1);
  return finalSquare !== undefined && isCrownSquare(finalSquare, original.player);
}

function manCaptureSteps(
  piece: Piece,
  board: PieceMap,
  config: RuleConfig,
): Array<{ landing: number; captured: Piece }> {
  const { row, column } = squareToCoordinate(piece.square);
  const allowedRows = config.menCaptureBackward
    ? [-1, 1]
    : [forwardDirection(piece.player)];
  const steps: Array<{ landing: number; captured: Piece }> = [];

  for (const rowDirection of allowedRows) {
    for (const columnDirection of [-1, 1]) {
      const jumpedSquare = coordinateToSquare(
        row + rowDirection,
        column + columnDirection,
      );
      const landing = coordinateToSquare(
        row + rowDirection * 2,
        column + columnDirection * 2,
      );
      if (jumpedSquare === null || landing === null || board.has(landing)) {
        continue;
      }
      const captured = board.get(jumpedSquare);
      if (captured && captured.player !== piece.player) {
        steps.push({ landing, captured });
      }
    }
  }

  return steps;
}

function kingCaptureSteps(
  piece: Piece,
  board: PieceMap,
): Array<{ landing: number; captured: Piece }> {
  const { row, column } = squareToCoordinate(piece.square);
  const steps: Array<{ landing: number; captured: Piece }> = [];

  for (const [rowDirection, columnDirection] of DIAGONALS) {
    let distance = 1;
    let captured: Piece | undefined;

    while (true) {
      const square = coordinateToSquare(
        row + rowDirection * distance,
        column + columnDirection * distance,
      );
      if (square === null) break;

      const occupant = board.get(square);
      if (!captured) {
        if (!occupant) {
          distance += 1;
          continue;
        }
        if (occupant.player === piece.player) break;
        captured = occupant;
        distance += 1;
        continue;
      }

      if (occupant) break;
      steps.push({ landing: square, captured });
      distance += 1;
    }
  }

  return steps;
}

function shortKingCaptureSteps(
  piece: Piece,
  board: PieceMap,
): Array<{ landing: number; captured: Piece }> {
  const { row, column } = squareToCoordinate(piece.square);
  const steps: Array<{ landing: number; captured: Piece }> = [];

  for (const [rowDirection, columnDirection] of DIAGONALS) {
    const jumpedSquare = coordinateToSquare(
      row + rowDirection,
      column + columnDirection,
    );
    const landing = coordinateToSquare(
      row + rowDirection * 2,
      column + columnDirection * 2,
    );
    if (jumpedSquare === null || landing === null || board.has(landing)) {
      continue;
    }
    const captured = board.get(jumpedSquare);
    if (captured && captured.player !== piece.player) {
      steps.push({ landing, captured });
    }
  }

  return steps;
}

function captureSteps(
  piece: Piece,
  board: PieceMap,
  config: RuleConfig,
): Array<{ landing: number; captured: Piece }> {
  if (piece.kind === "king") {
    return config.flyingKings
      ? kingCaptureSteps(piece, board)
      : shortKingCaptureSteps(piece, board);
  }
  return manCaptureSteps(piece, board, config);
}

function searchCaptureSequences(
  original: Piece,
  current: Piece,
  board: PieceMap,
  config: RuleConfig,
  path: readonly number[],
  capturedPieceIds: readonly string[],
): Move[] {
  const steps = captureSteps(current, board, config);

  if (steps.length === 0) {
    if (capturedPieceIds.length === 0) return [];
    return [
      Object.freeze({
        pieceId: original.id,
        from: original.square,
        path: Object.freeze([...path]),
        capturedPieceIds: Object.freeze([...capturedPieceIds]),
        promotes: didPromote(original, current.kind, path, config),
      }),
    ];
  }

  const moves: Move[] = [];
  for (const step of steps) {
    const nextBoard = new Map(board);
    nextBoard.delete(current.square);
    nextBoard.delete(step.captured.square);

    const promotesNow =
      current.kind === "man" &&
      config.promotionTiming === "immediate" &&
      squareToCoordinate(step.landing).row === crownRow(current.player);
    const nextPiece: Piece = Object.freeze({
      ...current,
      square: step.landing,
      kind: promotesNow ? "king" : current.kind,
    });
    nextBoard.set(step.landing, nextPiece);

    moves.push(
      ...searchCaptureSequences(
        original,
        nextPiece,
        nextBoard,
        config,
        [...path, step.landing],
        [...capturedPieceIds, step.captured.id],
      ),
    );
  }

  return moves;
}

export function generateCaptures(
  state: BoardState,
  pieceId: string,
  config: RuleConfig,
): Move[] {
  const piece = state.pieces.find((candidate) => candidate.id === pieceId);
  if (!piece || piece.player !== state.sideToMove) return [];
  return searchCaptureSequences(
    piece,
    piece,
    pieceMap(state.pieces),
    config,
    [],
    [],
  );
}

function generateQuietMoves(
  state: BoardState,
  piece: Piece,
  config: RuleConfig,
): Move[] {
  const board = pieceMap(state.pieces);
  const { row, column } = squareToCoordinate(piece.square);
  const moves: Move[] = [];

  if (piece.kind === "king" && config.flyingKings) {
    for (const [rowDirection, columnDirection] of DIAGONALS) {
      let distance = 1;
      while (true) {
        const destination = coordinateToSquare(
          row + rowDirection * distance,
          column + columnDirection * distance,
        );
        if (destination === null || board.has(destination)) break;
        moves.push(
          Object.freeze({
            pieceId: piece.id,
            from: piece.square,
            path: Object.freeze([destination]),
            capturedPieceIds: Object.freeze([]),
            promotes: false,
          }),
        );
        distance += 1;
      }
    }
    return moves;
  }

  const directions =
    piece.kind === "king"
      ? DIAGONALS
      : ([-1, 1] as const).map(
          (columnDirection) =>
            [forwardDirection(piece.player), columnDirection] as const,
        );
  for (const [rowDirection, columnDirection] of directions) {
    const destination = coordinateToSquare(
      row + rowDirection,
      column + columnDirection,
    );
    if (destination === null || board.has(destination)) continue;
    moves.push(
      Object.freeze({
        pieceId: piece.id,
        from: piece.square,
        path: Object.freeze([destination]),
        capturedPieceIds: Object.freeze([]),
        promotes: isCrownSquare(destination, piece.player),
      }),
    );
  }
  return moves;
}

export function getLegalMoves(
  state: BoardState,
  config: RuleConfig,
): Move[] {
  const candidates = state.forcedPieceId
    ? state.pieces.filter(
        (piece) =>
          piece.player === state.sideToMove && piece.id === state.forcedPieceId,
      )
    : state.pieces.filter((piece) => piece.player === state.sideToMove);

  let captures = candidates.flatMap((piece) =>
    generateCaptures(state, piece.id, config),
  );
  if (captures.length > 0 && config.requireMaximumCapture) {
    const maximum = Math.max(
      ...captures.map((move) => move.capturedPieceIds.length),
    );
    captures = captures.filter(
      (move) => move.capturedPieceIds.length === maximum,
    );
  }

  if (state.forcedPieceId !== undefined) return captures;
  if (captures.length > 0 && config.mandatoryCapture) return captures;

  const quietMoves = candidates.flatMap((piece) =>
    generateQuietMoves(state, piece, config),
  );
  return captures.length > 0 ? [...captures, ...quietMoves] : quietMoves;
}

export function validateMove(
  state: BoardState,
  move: Move,
  config: RuleConfig,
): ValidationResult {
  const piece = state.pieces.find((candidate) => candidate.id === move.pieceId);
  if (!piece) return { valid: false, reason: "Unknown piece." };
  if (piece.player !== state.sideToMove) {
    return { valid: false, reason: "The piece does not belong to the side to move." };
  }
  if (move.from !== piece.square) {
    return { valid: false, reason: "The move starts from the wrong square." };
  }

  const canonicalMove = getLegalMoves(state, config).find((candidate) =>
    matchingMove(candidate, move),
  );
  if (!canonicalMove) {
    return {
      valid: false,
      reason: "The move is not legal in the current position.",
    };
  }
  return { valid: true, canonicalMove };
}

export function applyMove(
  state: BoardState,
  move: Move,
  config: RuleConfig,
): BoardState {
  const validation = validateMove(state, move, config);
  if (!validation.valid || !validation.canonicalMove) {
    throw new Error(validation.reason ?? "Illegal move.");
  }
  const canonical = validation.canonicalMove;
  const movingPiece = state.pieces.find(
    (piece) => piece.id === canonical.pieceId,
  );
  if (!movingPiece) throw new Error("Moving piece disappeared.");

  const capturedIds = new Set(canonical.capturedPieceIds);
  const finalSquare = canonical.path.at(-1);
  if (finalSquare === undefined) throw new Error("A move requires a destination.");

  const movedPiece: Piece = Object.freeze({
    ...movingPiece,
    square: finalSquare,
    kind: canonical.promotes ? "king" : movingPiece.kind,
  });
  const pieces = state.pieces
    .filter(
      (piece) => piece.id !== movingPiece.id && !capturedIds.has(piece.id),
    )
    .concat(movedPiece)
    .sort((left, right) => left.id.localeCompare(right.id));
  const nextPlayer = opponent(state.sideToMove);

  return Object.freeze({
    pieces: Object.freeze(pieces),
    sideToMove: nextPlayer,
    moveNumber: state.moveNumber + 1,
    halfMoveClock:
      canonical.capturedPieceIds.length > 0 || canonical.promotes
        ? 0
        : state.halfMoveClock + 1,
    positionHash: hashPosition(pieces, nextPlayer),
  });
}

export function isTerminal(
  state: BoardState,
  config: RuleConfig,
): TerminalResult | null {
  const loser = state.sideToMove;
  const winner = opponent(loser);
  const pieceCount = state.pieces.filter(
    (piece) => piece.player === loser,
  ).length;

  if (pieceCount === 0) return { winner, loser, reason: "no_pieces" };
  if (config.onePieceRemainingMeansLoss && pieceCount === 1) {
    return { winner, loser, reason: "one_piece_remaining" };
  }
  if (getLegalMoves(state, config).length === 0) {
    return { winner, loser, reason: "no_legal_moves" };
  }
  return null;
}
