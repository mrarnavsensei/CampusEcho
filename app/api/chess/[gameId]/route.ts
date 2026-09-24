import { z } from "zod";
import { ApiError, jsonError, jsonOk, readJson, requireApiUser } from "@/lib/api";
import { chessOutcome, chooseAiMove, restoreChess } from "@/lib/chess-core";
import { assertOpponentAvailable, chessGameResponse, getChessGame, requirePlayer, updateChessGame } from "@/lib/chess-server";
import { consumeRateLimit, enforceSameOrigin, requireFeature } from "@/lib/security";

type Context = { params: Promise<{ gameId: string }> };
export async function GET(request: Request, context: Context) {
  try { const user = await requireApiUser(request); return jsonOk(await chessGameResponse((await context.params).gameId, user)); } catch (error) { return jsonError(error); }
}

const actionInput = z.object({ action: z.enum(["join", "move", "resign", "offer_draw", "accept_draw", "decline_draw", "cancel"]), version: z.number().int().nonnegative(), from: z.string().regex(/^[a-h][1-8]$/).optional(), to: z.string().regex(/^[a-h][1-8]$/).optional(), promotion: z.enum(["q", "r", "b", "n"]).optional() }).strict();
export async function POST(request: Request, context: Context) {
  try {
    enforceSameOrigin(request);
    const user = await requireApiUser(request);
    await consumeRateLimit(`chess:action:${user.id}`, 90, 60_000);
    const parsed = actionInput.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(422, "invalid_action", "Send a valid game action and version.");
    const input = parsed.data;
    if (!["resign", "cancel"].includes(input.action)) await requireFeature("chess_enabled");
    const game = await getChessGame((await context.params).gameId, user);
    if (input.version !== game.version) throw new ApiError(409, "game_changed", "The game changed. Refresh and try again.");
    if (input.action === "join") {
      if (game.mode !== "multiplayer" || game.status !== "waiting" || game.blackUserId || game.whiteUserId === user.id) throw new ApiError(409, "cannot_join", "This game cannot be joined.");
      await assertOpponentAvailable(game.whiteUserId, user);
      await updateChessGame(game, { blackUserId: user.id, status: "active" }, user.id);
    } else {
      const color = requirePlayer(game, user);
      if (input.action === "cancel") {
        if (game.status !== "waiting") throw new ApiError(409, "game_started", "An active game must be resigned, not cancelled.");
        await updateChessGame(game, { status: "cancelled" });
      } else {
        if (game.status !== "active") throw new ApiError(409, "game_not_active", "This game is not active.");
        if (input.action === "resign") {
          await updateChessGame(game, { status: "completed", result: color === "w" ? "0-1" : "1-0", resultReason: "resignation", completedAt: new Date(), drawOfferedBy: null });
        } else if (input.action === "offer_draw") {
          if (game.mode === "ai") throw new ApiError(422, "draw_not_supported", "The practice opponent does not accept draw offers.");
          if (game.drawOfferedBy) throw new ApiError(409, "draw_pending", "A draw offer is already pending.");
          await updateChessGame(game, { drawOfferedBy: user.id });
        } else if (input.action === "accept_draw" || input.action === "decline_draw") {
          if (!game.drawOfferedBy || game.drawOfferedBy === user.id) throw new ApiError(409, "no_draw_offer", "There is no opponent draw offer to answer.");
          await updateChessGame(game, input.action === "accept_draw" ? { status: "completed", result: "1/2-1/2", resultReason: "draw agreement", completedAt: new Date(), drawOfferedBy: null } : { drawOfferedBy: null });
        } else {
          const chess = restoreChess(game.pgn);
          if (chess.turn() !== color) throw new ApiError(409, "not_your_turn", "Wait for your opponent to move.");
          if (!input.from || !input.to) throw new ApiError(422, "move_required", "Choose a piece and destination.");
          try { chess.move({ from: input.from, to: input.to, promotion: input.promotion ?? "q" }); } catch { throw new ApiError(422, "illegal_move", "That move is not legal."); }
          let outcome = chessOutcome(chess);
          if (!outcome && game.mode === "ai") {
            const reply = chooseAiMove(chess, game.difficulty);
            if (reply) chess.move(reply);
            outcome = chessOutcome(chess);
          }
          await updateChessGame(game, { fen: chess.fen(), pgn: chess.pgn(), ply: chess.history().length, drawOfferedBy: !outcome && game.drawOfferedBy === user.id ? user.id : null, ...(outcome ? { status: "completed", result: outcome.result, resultReason: outcome.reason, completedAt: new Date() } : {}) });
        }
      }
    }
    return jsonOk(await chessGameResponse(game.id, user));
  } catch (error) { return jsonError(error); }
}
