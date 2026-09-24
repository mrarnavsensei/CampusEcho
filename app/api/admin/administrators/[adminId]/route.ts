import { and, count, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { adminAccounts, adminSessions } from "@/db/schema";
import { ApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { ADMIN_ROLES, requireAdminFromRequest } from "@/lib/admin-auth";
import { requireSameOrigin } from "@/lib/admin-api";
import { adminAuditStatement } from "@/lib/admin-audit";
type Context = { params: Promise<{ adminId: string }> };
export async function PATCH(request: Request, { params }: Context) {
  try {
    requireSameOrigin(request); const actor = await requireAdminFromRequest(request, ["super_admin"]); const { adminId } = await params;
    const body = await readJson<{ role?: string; status?: string }>(request);
    if (!body.role && !body.status) throw new ApiError(400, "invalid_update", "Select a role or status to change.");
    if (body.role && !Object.values(ADMIN_ROLES).includes(body.role as typeof ADMIN_ROLES[keyof typeof ADMIN_ROLES])) throw new ApiError(400, "invalid_role", "Invalid administrator role.");
    if (body.status && !["active", "inactive"].includes(body.status)) throw new ApiError(400, "invalid_status", "Invalid administrator status.");
    if (adminId === actor.id && (body.status === "inactive" || (body.role && body.role !== "super_admin"))) throw new ApiError(400, "self_deactivation", "Another Super Admin must change your access.");
    const db = getDb(), now = new Date();
    const [target] = await db.select().from(adminAccounts).where(eq(adminAccounts.id, adminId)).limit(1);
    if (!target) throw new ApiError(404, "not_found", "Administrator not found.");
    if (target.role === "super_admin" && target.status === "active" && (body.status === "inactive" || (body.role && body.role !== "super_admin"))) {
      const [total] = await db.select({ value: count() }).from(adminAccounts).where(and(eq(adminAccounts.role, "super_admin"), eq(adminAccounts.status, "active")));
      if ((total?.value ?? 0) <= 1) throw new ApiError(409, "last_admin", "The last active Super Admin cannot be removed.");
    }
    await db.batch([db.update(adminAccounts).set({ ...(body.role ? { role: body.role } : {}), ...(body.status ? { status: body.status } : {}), updatedAt: now }).where(eq(adminAccounts.id, adminId)), db.update(adminSessions).set({ revokedAt: now }).where(eq(adminSessions.adminId, adminId)), adminAuditStatement({ adminId: actor.id, action: "admin.update", targetType: "admin_account", targetId: adminId, metadata: { role: body.role, status: body.status } })]);
    return jsonOk({ updated: true });
  } catch (error) { return jsonError(error); }
}
