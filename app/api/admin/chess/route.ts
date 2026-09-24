import { and, count, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { getDb } from "@/db";
import { chessGames } from "@/db/chess-schema";
import { profiles } from "@/db/schema";
import { jsonError, jsonOk } from "@/lib/api";
import { requireAdminFromRequest } from "@/lib/admin-auth";
import { adminPage, adminPagination } from "@/lib/admin-api";
export async function GET(request: Request) {
  try {
    await requireAdminFromRequest(request, ["super_admin", "event_manager", "moderator"]);
    const { params, page, pageSize, offset } = adminPagination(request), db = getDb();
    const white = alias(profiles, "admin_chess_white"), black = alias(profiles, "admin_chess_black");
    const status = params.get("status");
    const validStatus = status && ["completed", "cancelled", "active", "waiting"].includes(status) ? status as "completed" | "cancelled" | "active" | "waiting" : null;
    const where = and(eq(chessGames.mode, "multiplayer"), validStatus ? eq(chessGames.status, validStatus) : undefined);
    const [matches, [total], [stats]] = await Promise.all([
      db.select({ id: chessGames.id, white: white.handle, black: black.handle, status: chessGames.status, result: chessGames.result, createdAt: chessGames.createdAt }).from(chessGames).leftJoin(white, eq(white.userId, chessGames.whiteUserId)).leftJoin(black, eq(black.userId, chessGames.blackUserId)).where(where).orderBy(desc(chessGames.createdAt), desc(chessGames.id)).limit(pageSize).offset(offset),
      db.select({ value: count() }).from(chessGames).where(where),
      db.select({ totalMatches: count(), activeMatches: sql<number>`sum(case when ${chessGames.status} = 'active' then 1 else 0 end)`, completedMatches: sql<number>`sum(case when ${chessGames.status} = 'completed' then 1 else 0 end)`, waitingMatches: sql<number>`sum(case when ${chessGames.status} = 'waiting' then 1 else 0 end)` }).from(chessGames).where(eq(chessGames.mode, "multiplayer")),
    ]);
    return jsonOk({ ...adminPage(matches, total?.value ?? 0, page, pageSize), matches, stats });
  } catch (error) { return jsonError(error); }
}
