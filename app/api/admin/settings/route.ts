import { getDb } from "@/db";
import { platformSettings } from "@/db/schema";
import { ApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { requireAdminFromRequest } from "@/lib/admin-auth";
import { requireSameOrigin } from "@/lib/admin-api";
import { adminAuditStatement } from "@/lib/admin-audit";
const ALLOWED = new Set(["maintenance_mode", "user_registration_enabled", "manual_verification_required", "voice_spaces_enabled", "chess_enabled", "events_enabled", "direct_messages_enabled"]);
export async function GET(request: Request) { try { await requireAdminFromRequest(request, ["super_admin"]); const rows = await getDb().select().from(platformSettings); return jsonOk(Object.fromEntries(rows.filter(row => ALLOWED.has(row.key)).map(row => [row.key, row.value]))); } catch (error) { return jsonError(error); } }
export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const admin = await requireAdminFromRequest(request, ["super_admin"]);
    const { key, value } = await readJson<{ key?: string; value?: string }>(request);
    if (!key || !ALLOWED.has(key) || (value !== "true" && value !== "false")) throw new ApiError(400, "invalid_setting", "Select a supported setting with a true or false value.");
    const now = new Date(), db = getDb();
    await db.batch([db.insert(platformSettings).values({ key, value, updatedBy: admin.id, updatedAt: now }).onConflictDoUpdate({ target: platformSettings.key, set: { value, updatedBy: admin.id, updatedAt: now } }), adminAuditStatement({ adminId: admin.id, action: "setting.update", targetType: "platform_setting", targetId: key, metadata: { value } })]);
    return jsonOk({ key, value });
  } catch (error) { return jsonError(error); }
}
