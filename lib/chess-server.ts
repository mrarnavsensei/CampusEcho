import { and, desc, eq, isNull, ne, or, sql } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { alias } from "drizzle-orm/sqlite-core";
import { getDb } from "@/db";
import { chessGames, type ChessGame } from "@/db/chess-schema";
import { blocks, profiles, users } from "@/db/schema";
import { ApiError, type ApiUser } from "@/lib/api";
import { restoreChess } from "@/lib/chess-core";
import type { ChessRoom, ChessStanding } from "@/lib/chess-types";
import { CHESS_LEADERBOARD_QUERY } from "@/lib/chess-leaderboard-query";

const whiteProfiles = alias(profiles, "chess_white_profile");
const blackProfiles = alias(profiles, "chess_black_profile");
export async function getChessGame(id: string, user: ApiUser) {
  const [game] = await getDb().select().from(chessGames).where(and(eq(chessGames.id, id), eq(chessGames.campusId, user.campusId))).limit(1);
  if (!game || (game.whiteUserId !== user.id && game.blackUserId !== user.id && game.status !== "waiting")) {
    throw new ApiError(404, "game_not_found", "This game is not available.");
  }
  if (game.whiteUserId !== user.id && game.blackUserId !== user.id) await assertOpponentAvailable(game.whiteUserId, user);
  return game;
}

export function requirePlayer(game: ChessGame, user: ApiUser): "w" | "b" {
  if (game.whiteUserId === user.id) return "w";
  if (game.blackUserId === user.id) return "b";
  throw new ApiError(403, "not_a_player", "Only players in this game can act.");
}

export async function assertOpponentAvailable(whiteId: string, user: ApiUser) {
  const db = getDb();
  const [opponent] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, whiteId), eq(users.campusId, user.campusId), eq(users.status, "active"), isNull(users.deletedAt))).limit(1);
  const [blocked] = await db.select({ id: blocks.blockerId }).from(blocks).where(or(and(eq(blocks.blockerId, user.id), eq(blocks.blockedId, whiteId)), and(eq(blocks.blockerId, whiteId), eq(blocks.blockedId, user.id)))).limit(1);
  if (!opponent || blocked) throw new ApiError(403, "opponent_unavailable", "This opponent is not available.");
}

function presentGame(game: ChessGame, user: ApiUser, white: string | null, black: string | null): ChessRoom {
  const chess = restoreChess(game.pgn);
  const yourColor = game.whiteUserId === user.id ? "w" : game.blackUserId === user.id ? "b" : null;
  return {
    id: game.id, mode: game.mode, difficulty: game.difficulty, status: game.status,
    fen: game.fen, version: game.version, result: game.result, resultReason: game.resultReason,
    yourColor, white: white ?? "Student", black: game.mode === "ai" ? `Echo AI · ${game.difficulty}` : black ?? "Waiting for a student",
    drawOffer: game.drawOfferedBy ? game.drawOfferedBy === user.id ? "yours" : "opponent" : null,
    moves: chess.history(), legalMoves: game.status === "active" && yourColor === chess.turn() ? chess.moves({ verbose: true }).map(m => ({ from: m.from, to: m.to, ...(m.promotion ? { promotion: m.promotion } : {}) })) : [],
    inCheck: chess.inCheck(), turn: chess.turn(), createdAt: game.createdAt.toISOString(), updatedAt: game.updatedAt.toISOString(),
  };
}

function gameQuery() {
  return getDb().select({ game: chessGames, white: whiteProfiles.displayName, black: blackProfiles.displayName }).from(chessGames)
    .leftJoin(whiteProfiles, eq(whiteProfiles.userId, chessGames.whiteUserId)).leftJoin(blackProfiles, eq(blackProfiles.userId, chessGames.blackUserId));
}

export async function chessGameResponse(id: string, user: ApiUser) {
  await getChessGame(id, user);
  const [row] = await gameQuery().where(eq(chessGames.id, id)).limit(1);
  if (!row) throw new ApiError(404, "game_not_found", "This game is not available.");
  return presentGame(row.game, user, row.white, row.black);
}

export async function listChessGames(user: ApiUser) {
  const [mine, waiting] = await Promise.all([
    gameQuery().where(and(eq(chessGames.campusId, user.campusId), or(eq(chessGames.whiteUserId, user.id), eq(chessGames.blackUserId, user.id)))).orderBy(desc(chessGames.updatedAt)).limit(20),
    gameQuery().where(and(eq(chessGames.campusId, user.campusId), eq(chessGames.status, "waiting"), ne(chessGames.whiteUserId, user.id),
      sql`exists (select 1 from users u where u.id = ${chessGames.whiteUserId} and u.status = 'active' and u.deleted_at is null)`,
      sql`not exists (select 1 from blocks b where (b.blocker_id = ${user.id} and b.blocked_id = ${chessGames.whiteUserId}) or (b.blocked_id = ${user.id} and b.blocker_id = ${chessGames.whiteUserId}))`
    )).orderBy(desc(chessGames.createdAt)).limit(20),
  ]);
  return { mine: mine.map(r => presentGame(r.game, user, r.white, r.black)), waiting: waiting.map(r => presentGame(r.game, user, r.white, r.black)), sync: "polling" };
}

export async function updateChessGame(game: ChessGame, values: Partial<typeof chessGames.$inferInsert>, joiningUserId?: string) {
  const conditions = [eq(chessGames.id, game.id), eq(chessGames.version, game.version)];
  if (joiningUserId) conditions.push(sql`(select count(*) from chess_games cap where (cap.white_user_id=${joiningUserId} or cap.black_user_id=${joiningUserId}) and cap.status in ('waiting','active')) < 5`);
  const changed = await getDb().update(chessGames).set({ ...values, version: game.version + 1, updatedAt: new Date() }).where(and(...conditions)).returning({ id: chessGames.id });
  if (!changed.length) throw new ApiError(409, "game_changed", "The game changed. Refresh and try again.");
}

// These are participation standings, not Elo or anti-cheat certification.
// Only the first completed game for each opponent pair/UTC day counts, with >= 8 plies.
export async function getChessLeaderboard({ campusId, period }: { campusId?: string; period: "weekly" | "monthly" | "all" }): Promise<ChessStanding[]> {
  const since = period === "all" ? 0 : Date.now() - (period === "weekly" ? 7 : 30) * 86_400_000;
  if (!env.DB) throw new ApiError(503, "database_unavailable", "Standings are temporarily unavailable.");
  const rows = await env.DB.prepare(CHESS_LEADERBOARD_QUERY).bind(since, campusId ?? null, campusId ?? null).all<ChessStanding>();
  return rows.results;
}
