import { and, count, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { campuses, moderationDecisions, posts, profiles, reports, sessions, users } from "@/db/schema";
import { studentVerifications } from "@/db/auth-schema";
import { ApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { requireAdminFromRequest } from "@/lib/admin-auth";
import { requireSameOrigin } from "@/lib/admin-api";
import { adminAuditStatement } from "@/lib/admin-audit";
type Context = { params: Promise<{ userId: string }> };
export async function GET(request: Request, { params }: Context) {
  try {
    const admin = await requireAdminFromRequest(request, ["super_admin", "moderator", "support_admin"]);
    const { userId } = await params, db = getDb();
    const [user] = await db.select({ id: users.id, email: users.email, emailVerifiedAt: users.emailVerifiedAt, role: users.role, status: users.status, createdAt: users.createdAt, updatedAt: users.updatedAt, handle: profiles.handle, displayName: profiles.displayName, campus: campuses.name, verificationStatus: studentVerifications.status, reviewNote: studentVerifications.reviewNote }).from(users).leftJoin(profiles, eq(profiles.userId, users.id)).leftJoin(campuses, eq(campuses.id, users.campusId)).leftJoin(studentVerifications, eq(studentVerifications.userId, users.id)).where(eq(users.id, userId)).limit(1);
    if (!user) throw new ApiError(404, "not_found", "User not found.");
    const [[postCount], [reportCount], history] = await Promise.all([
      db.select({ value: count() }).from(posts).where(eq(posts.authorId, userId)),
      db.select({ value: count() }).from(reports).where(and(eq(reports.targetType, "user"), eq(reports.targetId, userId))),
      db.select({ id: moderationDecisions.id, outcome: moderationDecisions.outcome, reason: moderationDecisions.reason, createdAt: moderationDecisions.createdAt }).from(moderationDecisions).where(and(eq(moderationDecisions.subjectType, "user"), eq(moderationDecisions.subjectId, userId))).orderBy(desc(moderationDecisions.createdAt)).limit(50),
    ]);
    return jsonOk({ ...user, canRestrict: ["super_admin", "moderator"].includes(admin.role), canBan: admin.role === "super_admin", canVerify: ["super_admin", "support_admin"].includes(admin.role), history, stats: { postsCount: postCount?.value ?? 0, reportsReceived: reportCount?.value ?? 0, modHistoryCount: history.length } });
  } catch (error) { return jsonError(error); }
}
export async function PATCH(request: Request, { params }: Context) {
  try {
    requireSameOrigin(request);
    const admin = await requireAdminFromRequest(request, ["super_admin", "moderator", "support_admin"]);
    const { userId } = await params;
    const { action, reason } = await readJson<{ action?: string; reason?: string }>(request);
    if (typeof reason !== "string" || reason.trim().length < 3 || reason.length > 2000) throw new ApiError(400, "reason_required", "Provide a reason between 3 and 2,000 characters.");
    if (!action || !["suspend", "unsuspend", "ban", "verify", "reject_verification"].includes(action)) throw new ApiError(400, "invalid_action", "Unsupported account action.");
    const db = getDb(), now = new Date();
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new ApiError(404, "not_found", "User not found.");
    if (user.deletedAt) throw new ApiError(409, "account_deleted", "Deleted accounts cannot be changed here.");
    const audit = adminAuditStatement({ adminId: admin.id, action: `user.${action}`, targetType: "user", targetId: userId, campusId: user.campusId, metadata: { reason: reason.trim(), previousStatus: user.status } });
    const decision = db.insert(moderationDecisions).values({ id: crypto.randomUUID(), campusId: user.campusId, subjectType: "user", subjectId: userId, provider: "admin", outcome: action, reason: reason.trim(), createdAt: now });
    if (action === "verify" || action === "reject_verification") {
      if (!["super_admin", "support_admin"].includes(admin.role)) throw new ApiError(403, "admin_forbidden", "Student verification requires a support or Super Admin role.");
      if (action === "verify" && !user.emailVerifiedAt) throw new ApiError(409, "email_unverified", "The student must verify their email before manual approval.");
      const status = action === "verify" ? "approved" : "rejected";
      await db.batch([db.insert(studentVerifications).values({ userId, status, reviewedBy: admin.id, reviewNote: reason.trim(), updatedAt: now }).onConflictDoUpdate({ target: studentVerifications.userId, set: { status, reviewedBy: admin.id, reviewNote: reason.trim(), updatedAt: now } }), decision, audit]);
      return jsonOk({ verificationStatus: status });
    }
    if (admin.role === "support_admin" || ((action === "ban" || user.status === "banned") && admin.role !== "super_admin")) throw new ApiError(403, "admin_forbidden", "This account action requires a higher administrator role.");
    const status = action === "suspend" ? "suspended" : action === "ban" ? "banned" : "active";
    await db.batch([db.update(users).set({ status, updatedAt: now }).where(eq(users.id, userId)), db.update(sessions).set({ revokedAt: now }).where(eq(sessions.userId, userId)), decision, audit]);
    return jsonOk({ status });
  } catch (error) { return jsonError(error); }
}
