import { and, count, desc, eq, like, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { campuses, profiles, users } from "@/db/schema";
import { studentVerifications } from "@/db/auth-schema";
import { jsonError, jsonOk } from "@/lib/api";
import { requireAdminFromRequest } from "@/lib/admin-auth";
import { adminPage, adminPagination } from "@/lib/admin-api";
export async function GET(request: Request) {
  try {
    await requireAdminFromRequest(request, ["super_admin", "moderator", "support_admin"]);
    const { params, page, pageSize, offset } = adminPagination(request);
    const q = params.get("q")?.trim().slice(0, 100), status = params.get("status"), campus = params.get("campus");
    const where = and(q ? or(like(users.email, `%${q}%`), like(profiles.handle, `%${q}%`), like(profiles.displayName, `%${q}%`)) : undefined, status && status !== "all" ? eq(users.status, status) : undefined, campus && campus !== "all" ? eq(users.campusId, campus) : undefined);
    const db = getDb();
    const [items, [total], colleges] = await Promise.all([
      db.select({ id: users.id, email: users.email, emailVerifiedAt: users.emailVerifiedAt, verificationStatus: sql<string>`coalesce(${studentVerifications.status}, 'unreviewed')`, role: users.role, status: users.status, createdAt: users.createdAt, handle: profiles.handle, displayName: profiles.displayName, campus: campuses.name }).from(users).leftJoin(profiles, eq(profiles.userId, users.id)).leftJoin(campuses, eq(campuses.id, users.campusId)).leftJoin(studentVerifications, eq(studentVerifications.userId, users.id)).where(where).orderBy(desc(users.createdAt), desc(users.id)).limit(pageSize).offset(offset),
      db.select({ value: count() }).from(users).leftJoin(profiles, eq(profiles.userId, users.id)).where(where),
      db.select({ id: campuses.id, name: campuses.name }).from(campuses),
    ]);
    return jsonOk({ ...adminPage(items, total?.value ?? 0, page, pageSize), colleges });
  } catch (error) { return jsonError(error); }
}
