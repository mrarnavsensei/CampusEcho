import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { adminAccounts, auditLogs, comments, moderationDecisions, posts, profiles, reports, voiceRooms } from "@/db/schema";
import { reportReviews } from "@/db/admin-schema";
import { ApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { requireAdminFromRequest } from "@/lib/admin-auth";
import { parseMetadata, requireSameOrigin } from "@/lib/admin-api";
import { adminAuditStatement } from "@/lib/admin-audit";
type Context = { params: Promise<{ reportId: string }> };

export async function GET(request: Request, { params }: Context) {
  try {
    const admin = await requireAdminFromRequest(request, ["super_admin", "moderator", "support_admin"]);
    const { reportId } = await params, db = getDb();
    const [report] = await db.select({ id: reports.id, type: reports.targetType, targetId: reports.targetId, reason: reports.reason, details: reports.details, status: reports.status, createdAt: reports.createdAt, assignedAdminId: reportReviews.assignedAdminId }).from(reports).leftJoin(reportReviews, eq(reportReviews.reportId, reports.id)).where(eq(reports.id, reportId)).limit(1);
    if (!report) throw new ApiError(404, "not_found", "Report not found.");
    // Never select anonymous author identifiers or private message bodies.
    let content: { body?: string; status?: string; visibility?: string; title?: string; handle?: string; displayName?: string; bio?: string } | null = null;
    if (report.type === "post") [content = null] = await db.select({ body: posts.body, status: posts.status, visibility: posts.visibility }).from(posts).where(eq(posts.id, report.targetId)).limit(1);
    if (report.type === "comment") [content = null] = await db.select({ body: comments.body, status: comments.status }).from(comments).where(eq(comments.id, report.targetId)).limit(1);
    if (report.type === "user") [content = null] = await db.select({ handle: profiles.handle, displayName: profiles.displayName, bio: profiles.bio }).from(profiles).where(eq(profiles.userId, report.targetId)).limit(1);
    if (report.type === "voice_room") [content = null] = await db.select({ title: voiceRooms.title, status: voiceRooms.status }).from(voiceRooms).where(eq(voiceRooms.id, report.targetId)).limit(1);
    const history = await db.select({ id: auditLogs.id, action: auditLogs.action, metadata: auditLogs.metadata, createdAt: auditLogs.createdAt }).from(auditLogs).where(and(eq(auditLogs.targetType, "report"), eq(auditLogs.targetId, reportId))).orderBy(desc(auditLogs.createdAt)).limit(50);
    const assignees = await db.select({ id: adminAccounts.id, displayName: adminAccounts.displayName }).from(adminAccounts).where(eq(adminAccounts.status, "active"));
    await adminAuditStatement({ adminId: admin.id, action: "report.view", targetType: "report", targetId: reportId });
    return jsonOk({ ...report, content, history: history.map(row => ({ ...row, metadata: parseMetadata(row.metadata) })), assignees, canModerate: ["super_admin", "moderator"].includes(admin.role) });
  } catch (error) { return jsonError(error); }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    requireSameOrigin(request);
    const admin = await requireAdminFromRequest(request, ["super_admin", "moderator", "support_admin"]);
    const { reportId } = await params;
    const body = await readJson<{ action?: string; note?: string; assignedAdminId?: string | null }>(request);
    const { action } = body;
    if (!action || !["resolve", "dismiss", "reopen", "remove", "restore", "assign", "note"].includes(action)) throw new ApiError(400, "invalid_action", "Unsupported moderation action.");
    if (typeof body.note !== "string" || body.note.trim().length < 3 || body.note.length > 2000) throw new ApiError(400, "reason_required", "Provide a review note between 3 and 2,000 characters.");
    const db = getDb();
    const [report] = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1);
    if (!report) throw new ApiError(404, "not_found", "Report not found.");
    const now = new Date();
    const audit = adminAuditStatement({ adminId: admin.id, action: `report.${action}`, targetType: "report", targetId: reportId, campusId: report.campusId, metadata: { note: body.note.trim(), assignedAdminId: action === "assign" ? body.assignedAdminId : undefined } });
    if (action === "assign") {
      if (body.assignedAdminId != null) {
        if (typeof body.assignedAdminId !== "string") throw new ApiError(400, "invalid_assignee", "Select an active administrator.");
        const [assignee] = await db.select({ id: adminAccounts.id }).from(adminAccounts).where(and(eq(adminAccounts.id, body.assignedAdminId), eq(adminAccounts.status, "active"))).limit(1);
        if (!assignee) throw new ApiError(400, "invalid_assignee", "Select an active administrator.");
      }
      await db.batch([db.insert(reportReviews).values({ reportId, assignedAdminId: body.assignedAdminId ?? null, updatedAt: now }).onConflictDoUpdate({ target: reportReviews.reportId, set: { assignedAdminId: body.assignedAdminId ?? null, updatedAt: now } }), audit]);
    } else if (action === "remove" || action === "restore") {
      if (admin.role === "support_admin") throw new ApiError(403, "admin_forbidden", "Only moderators and Super Admins can remove content.");
      if (!["post", "comment"].includes(report.targetType)) throw new ApiError(400, "unsupported_content", "Content actions apply to reported posts and comments only.");
      const table = report.targetType === "post" ? posts : comments;
      const [target] = await db.select({ id: table.id, deletedAt: table.deletedAt }).from(table).where(eq(table.id, report.targetId)).limit(1);
      if (!target || target.deletedAt) throw new ApiError(409, "content_unavailable", "The content was deleted by its author or no longer exists.");
      const status = action === "remove" ? "removed" : "published";
      const contentUpdate = report.targetType === "post"
        ? db.update(posts).set({ status, moderationStatus: action === "remove" ? "rejected" : "approved", updatedAt: now }).where(and(eq(posts.id, report.targetId), isNull(posts.deletedAt)))
        : db.update(comments).set({ status, updatedAt: now }).where(and(eq(comments.id, report.targetId), isNull(comments.deletedAt)));
      await db.batch([contentUpdate, db.update(reports).set({ status: "resolved", resolvedAt: now, updatedAt: now }).where(eq(reports.id, reportId)), db.insert(moderationDecisions).values({ id: crypto.randomUUID(), campusId: report.campusId, subjectType: report.targetType, subjectId: report.targetId, provider: "admin", outcome: action, categories: "[]", reason: body.note.trim(), createdAt: now }), audit]);
    } else if (action === "note") {
      await audit;
    } else {
      const status = action === "reopen" ? "open" : action === "resolve" ? "resolved" : "dismissed";
      await db.batch([db.update(reports).set({ status, resolvedAt: status === "open" ? null : now, updatedAt: now }).where(eq(reports.id, reportId)), audit]);
    }
    return jsonOk({ updated: true });
  } catch (error) { return jsonError(error); }
}
