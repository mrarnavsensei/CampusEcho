import { eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { campuses, collegeDomains, users } from "@/db/schema";
import { ApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { requireAdminFromRequest } from "@/lib/admin-auth";
import { requireSameOrigin } from "@/lib/admin-api";
import { adminAuditStatement } from "@/lib/admin-audit";
export async function GET(request: Request) {
  try {
    await requireAdminFromRequest(request); const db = getDb();
    const rows = await db.select({ id: campuses.id, name: campuses.name, slug: campuses.slug, status: campuses.status, createdAt: campuses.createdAt, usersCount: sql<number>`count(distinct ${users.id})` }).from(campuses).leftJoin(users, eq(users.campusId, campuses.id)).groupBy(campuses.id).orderBy(campuses.name).limit(500);
    const domains = rows.length ? await db.select({ campusId: collegeDomains.campusId, domain: collegeDomains.domain, verified: collegeDomains.verified }).from(collegeDomains).where(inArray(collegeDomains.campusId, rows.map(row => row.id))) : [];
    return jsonOk(rows.map(row => ({ ...row, domains: domains.filter(domain => domain.campusId === row.id), domainsCount: domains.filter(domain => domain.campusId === row.id).length })));
  } catch (error) { return jsonError(error); }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request); const admin = await requireAdminFromRequest(request, ["super_admin"]);
    const body = await readJson<{ name?: string; slug?: string; domain?: string }>(request);
    if (typeof body.name !== "string" || body.name.trim().length < 2 || body.name.length > 120 || typeof body.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug) || body.slug.length > 100 || typeof body.domain !== "string" || body.domain.length > 253 || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(body.domain.trim())) throw new ApiError(400, "invalid_college", "Valid college name, slug, and email domain are required.");
    const db = getDb(), id = crypto.randomUUID(), now = new Date(), domain = body.domain.trim().toLowerCase();
    const [[slugExists], [domainExists]] = await Promise.all([db.select({ id: campuses.id }).from(campuses).where(eq(campuses.slug, body.slug)).limit(1), db.select({ id: collegeDomains.id }).from(collegeDomains).where(eq(collegeDomains.domain, domain)).limit(1)]);
    if (slugExists || domainExists) throw new ApiError(409, "college_exists", "This college slug or email domain is already registered.");
    await db.batch([db.insert(campuses).values({ id, name: body.name.trim(), slug: body.slug, status: "active", createdAt: now, updatedAt: now }), db.insert(collegeDomains).values({ id: crypto.randomUUID(), campusId: id, domain, verified: true, createdAt: now }), adminAuditStatement({ adminId: admin.id, action: "college.create", targetType: "campus", targetId: id, metadata: { domain } })]);
    return jsonOk({ id }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
