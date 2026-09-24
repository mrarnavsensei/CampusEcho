import { and, eq, sql } from "drizzle-orm";
import { Chess } from "chess.js";
import { z } from "zod";
import { getDb } from "@/db";
import { chessGames } from "@/db/chess-schema";
import { ApiError, jsonError, jsonOk, readJson, requireApiUser } from "@/lib/api";
import { chessGameResponse, listChessGames } from "@/lib/chess-server";
import { consumeRateLimit, enforceSameOrigin, requireFeature } from "@/lib/security";

export async function GET(request: Request) {
  try { return jsonOk(await listChessGames(await requireApiUser(request))); } catch (error) { return jsonError(error); }
}

const createInput = z.object({ mode: z.enum(["ai", "multiplayer"]), difficulty: z.enum(["beginner", "practice"]).optional() }).strict();
export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const user = await requireApiUser(request);
    await requireFeature("chess_enabled");
    await consumeRateLimit(`chess:create:${user.id}`, 12, 3_600_000);
    const input = createInput.safeParse(await readJson(request));
    if (!input.success) throw new ApiError(422, "invalid_game", "Choose a valid game mode and difficulty.");
    const db = getDb();
    if (input.data.mode === "multiplayer") {
      const [waiting] = await db.select({ id: chessGames.id }).from(chessGames).where(and(eq(chessGames.whiteUserId, user.id), eq(chessGames.status, "waiting"))).limit(1);
      if (waiting) return jsonOk(await chessGameResponse(waiting.id, user));
    }
    const id = crypto.randomUUID(); const now = new Date();
    // The limit is checked by the same SQL statement as the insert, so concurrent
    // requests cannot create more active games after each reading a stale count.
    const inserted = await db.all<{ id: string }>(sql`INSERT INTO chess_games
      (id,campus_id,white_user_id,mode,difficulty,status,fen,created_at,updated_at)
      SELECT ${id},${user.campusId},${user.id},${input.data.mode},${input.data.difficulty ?? "practice"},${input.data.mode === "ai" ? "active" : "waiting"},${new Chess().fen()},${now.getTime()},${now.getTime()}
      WHERE (SELECT count(*) FROM chess_games WHERE (white_user_id=${user.id} OR black_user_id=${user.id}) AND status IN ('waiting','active')) < 5
      ON CONFLICT DO NOTHING RETURNING id`);
    if (!inserted.length) {
      const [waiting] = await db.select({ id: chessGames.id }).from(chessGames).where(and(eq(chessGames.whiteUserId, user.id), eq(chessGames.status, "waiting"))).limit(1);
      if (input.data.mode === "multiplayer" && waiting) return jsonOk(await chessGameResponse(waiting.id, user));
      throw new ApiError(409, "active_game_limit", "Finish or cancel an existing game before creating another.");
    }
    return jsonOk(await chessGameResponse(id, user), { status: 201 });
  } catch (error) { return jsonError(error); }
}
