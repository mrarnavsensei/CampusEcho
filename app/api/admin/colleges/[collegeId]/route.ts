import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { campuses } from "@/db/schema";
import { ApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { requireAdminFromRequest } from "@/lib/admin-auth";
import { requireSameOrigin } from "@/lib/admin-api";
import { adminAuditStatement } from "@/lib/admin-audit";
type Context = { params: Promise<{ collegeId: string }> };
export async function PATCH(request: Request, { params }: Context) {
  try {
    requireSameOrigin(request); const admin = await requireAdminFromRequest(request, ["super_admin"]); const { collegeId } = await params;
    const { status } = await readJson<{ status?: string }>(request);
    if (!status || !["active", "inactive"].includes(status)) throw new ApiError(400, "invalid_status", "Status must be active or inactive.");
    const db = getDb(), [college] = await db.select({ id: campuses.id }).from(campuses).where(eq(campuses.id, collegeId)).limit(1);
    if (!college) throw new ApiError(404, "not_found", "College not found.");
    await db.batch([db.update(campuses).set({ status, updatedAt: new Date() }).where(eq(campuses.id, collegeId)), adminAuditStatement({ adminId: admin.id, action: "college.status_change", targetType: "campus", targetId: collegeId, metadata: { status } })]);
    return jsonOk({ status });
  } catch (error) { return jsonError(error); }
}
