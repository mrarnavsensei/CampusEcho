import { ApiError, jsonError, jsonOk, requireApiUser } from "@/lib/api";
import { getChessLeaderboard } from "@/lib/chess-server";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser(request);
    const params = new URL(request.url).searchParams;
    const period = params.get("period") ?? "weekly";
    const scope = params.get("scope") ?? "campus";
    if (!["weekly", "monthly", "all"].includes(period) || !["campus", "global"].includes(scope)) throw new ApiError(422, "invalid_filter", "Choose a valid leaderboard period and scope.");
    return jsonOk(await getChessLeaderboard({ campusId: scope === "campus" ? user.campusId : undefined, period: period as "weekly" | "monthly" | "all" }));
  } catch (error) { return jsonError(error); }
}
