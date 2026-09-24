import { and, count, desc, eq, like, or } from "drizzle-orm";
import { getDb } from "@/db";
import { reports } from "@/db/schema";
import { reportReviews } from "@/db/admin-schema";
import { jsonError, jsonOk } from "@/lib/api";
import { requireAdminFromRequest } from "@/lib/admin-auth";
import { adminPage, adminPagination } from "@/lib/admin-api";

export async function GET(request: Request) {
  try {
    await requireAdminFromRequest(request, ["super_admin", "moderator", "support_admin"]);
    const { params, page, pageSize, offset } = adminPagination(request);
    const type = params.get("targetType"), status = params.get("status"), q = params.get("q")?.trim().slice(0, 100);
    const where = and(type && type !== "all" ? eq(reports.targetType, type) : undefined, status && status !== "all" ? eq(reports.status, status) : undefined, q ? or(like(reports.id, `%${q}%`), like(reports.reason, `%${q}%`), like(reports.targetId, `%${q}%`)) : undefined);
    const db = getDb();
    const [items, [total]] = await Promise.all([
      db.select({ id: reports.id, type: reports.targetType, targetId: reports.targetId, reason: reports.reason, details: reports.details, status: reports.status, createdAt: reports.createdAt, assignedAdminId: reportReviews.assignedAdminId }).from(reports).leftJoin(reportReviews, eq(reportReviews.reportId, reports.id)).where(where).orderBy(desc(reports.createdAt), desc(reports.id)).limit(pageSize).offset(offset),
      db.select({ value: count() }).from(reports).where(where),
    ]);
    return jsonOk(adminPage(items, total?.value ?? 0, page, pageSize));
  } catch (error) { return jsonError(error); }
}
