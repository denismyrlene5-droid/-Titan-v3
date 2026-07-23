import {
  DEFAULT_RULE_CONFIG,
  coordinateToSquare,
  isCrownSquare,
  type Piece,
  type Player,
} from "../../../../packages/game-engine/src/index.ts";
import { interactionView } from "../game/controller.ts";
import type {
  BoardOrientation,
  GameSession,
  PieceAppearance,
} from "../game/types.ts";

interface BoardProps {
  readonly session: GameSession;
  readonly orientation: BoardOrientation;
  readonly appearance: PieceAppearance;
  readonly disabled?: boolean;
  readonly onPiece: (pieceId: string) => void;
  readonly onDestination: (square: number) => void;
}

function displayPieces(session: GameSession): readonly Piece[] {
  if (!session.selectedPieceId || session.pathPrefix.length === 0) {
    return session.board.pieces;
  }
  const view = interactionView(session);
  const candidate = view.legalMoves.find(
    (move) =>
      move.pieceId === session.selectedPieceId &&
      session.pathPrefix.every(
        (destination, index) => move.path[index] === destination,
      ),
  );
  if (!candidate) return session.board.pieces;
  const removed = new Set(
    candidate.capturedPieceIds.slice(0, session.pathPrefix.length),
  );
  const currentSquare = session.pathPrefix.at(-1)!;
  return session.board.pieces
    .filter((piece) => !removed.has(piece.id))
    .map((piece) =>
      piece.id === session.selectedPieceId
        ? {
            ...piece,
            square: currentSquare,
            kind:
              piece.kind === "man" &&
              DEFAULT_RULE_CONFIG.promotionTiming === "immediate" &&
              session.pathPrefix.some((square) =>
                isCrownSquare(square, piece.player),
              )
                ? "king"
                : piece.kind,
          }
        : piece,
    );
}

function playerLabel(player: Player): string {
  return player === 1 ? "Gold" : "Onyx";
}

export function Board({
  session,
  orientation,
  appearance,
  disabled = false,
  onPiece,
  onDestination,
}: BoardProps) {
  const view = interactionView(session);
  const pieces = displayPieces(session);
  const pieceAt = new Map(pieces.map((piece) => [piece.square, piece]));
  const lastSquares = new Set(
    session.lastMove
      ? [session.lastMove.from, ...session.lastMove.path]
      : [],
  );
  const pathSquares = new Set(session.pathPrefix);
  const indexes =
    orientation === "player1"
      ? [...Array(10).keys()]
      : [...Array(10).keys()].reverse();

  return (
    <div
      className="board-shell"
      aria-label={`Ghana draughts board. ${playerLabel(session.board.sideToMove)} to move.`}
    >
      <div className="board" role="grid">
        {indexes.flatMap((row) =>
          indexes.map((column) => {
            const square = coordinateToSquare(row, column);
            const playable = square !== null;
            const piece = playable ? pieceAt.get(square) : undefined;
            const destination = playable && view.destinations.has(square);
            const selected = piece?.id === session.selectedPieceId;
            const selectable =
              piece !== undefined && view.selectablePieceIds.has(piece.id);
            const captureTarget =
              destination && view.captureRequired;
            const classNames = [
              "board-square",
              playable ? "playable" : "light",
              destination ? "destination" : "",
              captureTarget ? "capture-destination" : "",
              lastSquares.has(square ?? -1) ? "last-move" : "",
              pathSquares.has(square ?? -1) ? "capture-path" : "",
            ]
              .filter(Boolean)
              .join(" ");
            const action = () => {
              if (disabled) return;
              if (piece && selectable) onPiece(piece.id);
              else if (square !== null && destination) onDestination(square);
            };

            return (
              <button
                className={classNames}
                key={`${row}-${column}`}
                role="gridcell"
                type="button"
                disabled={!playable || disabled}
                onClick={action}
                aria-label={
                  piece
                    ? `${playerLabel(piece.player)} ${piece.kind} on square ${piece.square + 1}${selectable ? ", selectable" : ""}`
                    : destination
                      ? `Move to square ${square + 1}`
                      : playable
                        ? `Empty square ${square + 1}`
                        : "Unplayable square"
                }
              >
                {piece && (
                  <span
                    className={[
                      "piece",
                      `player-${piece.player}`,
                      piece.player === 1 ? `appearance-${appearance}` : "",
                      selected ? "selected" : "",
                      selectable ? "selectable" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {piece.kind === "king" && (
                      <span className="crown" aria-hidden="true">
                        ♛
                      </span>
                    )}
                  </span>
                )}
                {destination && <span className="move-dot" aria-hidden="true" />}
                {playable && (
                  <span className="square-number" aria-hidden="true">
                    {square + 1}
                  </span>
                )}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}
