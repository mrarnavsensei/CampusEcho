import { and, count, desc, like, or } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLogs } from "@/db/schema";
import { jsonError, jsonOk } from "@/lib/api";
import { requireAdminFromRequest } from "@/lib/admin-auth";
import { adminPage, adminPagination, parseMetadata } from "@/lib/admin-api";
export async function GET(request: Request) {
  try {
    await requireAdminFromRequest(request, ["super_admin"]);
    const { params, page, pageSize, offset } = adminPagination(request);
    const q = params.get("q")?.trim().slice(0, 100);
    const where = and(q ? or(like(auditLogs.action, `%${q}%`), like(auditLogs.targetType, `%${q}%`), like(auditLogs.targetId, `%${q}%`)) : undefined);
    const db = getDb();
    const [items, [total]] = await Promise.all([db.select().from(auditLogs).where(where).orderBy(desc(auditLogs.createdAt), desc(auditLogs.id)).limit(pageSize).offset(offset), db.select({ value: count() }).from(auditLogs).where(where)]);
    return jsonOk(adminPage(items.map(row => ({ ...row, metadata: parseMetadata(row.metadata) })), total?.value ?? 0, page, pageSize));
  } catch (error) { return jsonError(error); }
}
