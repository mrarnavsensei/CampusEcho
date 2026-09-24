import { count, gte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { chessMatches, events, messages, posts, reports, users, voiceRooms } from "@/db/schema";
import { ApiError, jsonError, jsonOk } from "@/lib/api";
import { requireAdminFromRequest } from "@/lib/admin-auth";
const TABLES = { Users: users, Posts: posts, Voice: voiceRooms, Events: events, Chess: chessMatches, Safety: reports, Messages: messages } as const;
export async function GET(request: Request) {
  try {
    await requireAdminFromRequest(request);
    const url = new URL(request.url), category = (url.searchParams.get("category") ?? "Users") as keyof typeof TABLES;
    if (!(category in TABLES)) throw new ApiError(400, "invalid_category", "Select a valid analytics category.");
    const period = url.searchParams.get("period") ?? "7d";
    if (!["7d", "30d", "90d"].includes(period)) throw new ApiError(400, "invalid_period", "Select 7, 30, or 90 days.");
    const days = Number.parseInt(period, 10), table = TABLES[category], since = new Date();
    since.setUTCHours(0, 0, 0, 0); since.setUTCDate(since.getUTCDate() - days + 1);
    const day = sql<string>`strftime('%Y-%m-%d', ${table.createdAt} / 1000, 'unixepoch')`;
    const rows = await getDb().select({ day, total: count() }).from(table).where(gte(table.createdAt, since)).groupBy(day);
    const counts = new Map(rows.map(row => [row.day, row.total]));
    const chartData = Array.from({ length: days }, (_, i) => { const date = new Date(since); date.setUTCDate(since.getUTCDate() + i); const label = date.toISOString().slice(0, 10); return { label: label.slice(5), value: counts.get(label) ?? 0 }; });
    const total = chartData.reduce((sum, row) => sum + row.value, 0), peak = Math.max(0, ...chartData.map(row => row.value));
    return jsonOk({ chartData, summary: [{ label: `New ${category}`, value: total }, { label: "Daily average", value: Math.round(total / days * 10) / 10 }, { label: "Peak day", value: peak }, { label: "Period (UTC)", value: `${days} days` }] });
  } catch (error) { return jsonError(error); }
}
