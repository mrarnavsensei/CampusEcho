import { Chess, type Move, type PieceSymbol } from "chess.js";

export type ChessResult = "1-0" | "0-1" | "1/2-1/2";

export function restoreChess(pgn: string): Chess {
  const chess = new Chess();
  if (pgn) chess.loadPgn(pgn, { strict: true });
  return chess;
}

export function chessOutcome(chess: Chess): { result: ChessResult; reason: string } | null {
  if (chess.isCheckmate()) return { result: chess.turn() === "w" ? "0-1" : "1-0", reason: "checkmate" };
  if (chess.isStalemate()) return { result: "1/2-1/2", reason: "stalemate" };
  if (chess.isThreefoldRepetition()) return { result: "1/2-1/2", reason: "threefold repetition" };
  if (chess.isInsufficientMaterial()) return { result: "1/2-1/2", reason: "insufficient material" };
  if (chess.isDrawByFiftyMoves()) return { result: "1/2-1/2", reason: "fifty-move rule" };
  return null;
}

const value: Record<PieceSymbol, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
function evaluate(chess: Chess): number {
  if (chess.isCheckmate()) return chess.turn() === "w" ? -100_000 : 100_000;
  if (chess.isDraw()) return 0;
  return chess.board().flat().reduce((score, piece) => {
    if (!piece) return score;
    const file = piece.square.charCodeAt(0) - 97;
    const rank = Number(piece.square[1]) - 1;
    const centrality = 7 - Math.abs(file - 3.5) - Math.abs(rank - 3.5);
    return score + (piece.color === "w" ? 1 : -1) * (value[piece.type] + (piece.type === "k" ? 0 : centrality * 4));
  }, 0);
}

/** Modest practice opponent: one/two-ply material search, bounded CPU; not Stockfish. */
export function chooseAiMove(chess: Chess, difficulty: "beginner" | "practice", maxNodes = 500): Move | null {
  if (chessOutcome(chess)) return null;
  const moves = chess.moves({ verbose: true }).sort((a, b) => Number(Boolean(b.captured)) - Number(Boolean(a.captured)));
  const maximizing = chess.turn() === "w";
  let best = moves[0] ?? null;
  let bestScore = maximizing ? -Infinity : Infinity;
  let nodes = 0;
  for (const move of moves) {
    chess.move(move);
    let score = evaluate(chess);
    nodes++;
    if (difficulty === "practice" && !chess.isGameOver() && nodes < maxNodes) {
      const replies = chess.moves({ verbose: true });
      let responseScore = maximizing ? Infinity : -Infinity;
      for (const reply of replies) {
        chess.move(reply);
        const result = evaluate(chess);
        chess.undo();
        responseScore = maximizing ? Math.min(responseScore, result) : Math.max(responseScore, result);
        if (++nodes >= maxNodes) break;
      }
      if (Number.isFinite(responseScore)) score = responseScore;
    }
    chess.undo();
    if ((maximizing && score > bestScore) || (!maximizing && score < bestScore)) { best = move; bestScore = score; }
    if (nodes >= maxNodes) break;
  }
  return best;
}
