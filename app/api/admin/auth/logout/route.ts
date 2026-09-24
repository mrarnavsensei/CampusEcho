import { clearAdminCookie, getAdminFromRequest, revokeAdminSession } from "@/lib/admin-auth";
import { jsonError, jsonOk } from "@/lib/api";
import { recordAdminAction } from "@/lib/admin-audit";
import { requireSameOrigin } from "@/lib/admin-api";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const admin = await getAdminFromRequest(request);
    const token = /(?:^|;\s*)admin_token=([^;]+)/.exec(request.headers.get("cookie") ?? "")?.[1];
    if (token && /^[a-f0-9]{64}$/.test(token)) await revokeAdminSession(token);
    if (admin) await recordAdminAction({ adminId: admin.id, action: "admin.logout", targetType: "admin_account", targetId: admin.id });
    return jsonOk({ loggedOut: true }, { headers: { "Set-Cookie": clearAdminCookie() } });
  } catch (error) { return jsonError(error); }
}
