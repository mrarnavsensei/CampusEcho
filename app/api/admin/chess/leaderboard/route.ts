import { ApiError, jsonError, jsonOk } from "@/lib/api";
import { requireAdminFromRequest } from "@/lib/admin-auth";
import { getChessLeaderboard } from "@/lib/chess-server";
export async function GET(request: Request) {
  try {
    await requireAdminFromRequest(request, ["super_admin", "event_manager", "moderator"]);
    const params = new URL(request.url).searchParams;
    const raw = params.get("period") ?? "weekly", period = raw === "all-time" ? "all" : raw;
    if (!["weekly", "monthly", "all"].includes(period)) throw new ApiError(400, "invalid_period", "Choose weekly, monthly, or all-time.");
    const rows = await getChessLeaderboard({ campusId: params.get("campusId") || undefined, period: period as "weekly" | "monthly" | "all" });
    return jsonOk(rows.map(row => ({ ...row, winRate: row.games ? Math.round(row.wins * 100 / row.games) : 0 })));
  } catch (error) { return jsonError(error); }
}
