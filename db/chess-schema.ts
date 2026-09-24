import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { campuses, users } from "./schema";

// Kept separate from legacy tournament metadata; every move and result is server-authored.
export const chessGames = sqliteTable("chess_games", {
  id: text("id").primaryKey(),
  campusId: text("campus_id").notNull().references(() => campuses.id),
  whiteUserId: text("white_user_id").notNull().references(() => users.id),
  blackUserId: text("black_user_id").references(() => users.id),
  mode: text("mode", { enum: ["ai", "multiplayer"] }).notNull(),
  difficulty: text("difficulty", { enum: ["beginner", "practice"] }).notNull().default("practice"),
  status: text("status", { enum: ["waiting", "active", "completed", "cancelled"] }).notNull(),
  fen: text("fen").notNull(),
  pgn: text("pgn").notNull().default(""),
  ply: integer("ply").notNull().default(0),
  version: integer("version").notNull().default(0),
  result: text("result", { enum: ["1-0", "0-1", "1/2-1/2"] }),
  resultReason: text("result_reason"),
  drawOfferedBy: text("draw_offered_by").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
}, t => [index("chess_games_campus_status_idx").on(t.campusId, t.status, t.createdAt), index("chess_games_white_idx").on(t.whiteUserId, t.updatedAt), index("chess_games_black_idx").on(t.blackUserId, t.updatedAt), index("chess_games_completed_idx").on(t.mode, t.status, t.completedAt)]);

export type ChessGame = typeof chessGames.$inferSelect;
