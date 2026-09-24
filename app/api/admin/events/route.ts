import { and, count, desc, eq, gt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { campuses, events, registrations } from "@/db/schema";
import { ApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { requireAdminFromRequest } from "@/lib/admin-auth";
import { adminPage, adminPagination, requireSameOrigin } from "@/lib/admin-api";
import { adminAuditStatement } from "@/lib/admin-audit";
export async function GET(request: Request) {
  try {
    await requireAdminFromRequest(request, ["super_admin", "event_manager"]);
    const db = getDb(), { params, page, pageSize, offset } = adminPagination(request);
    const status = params.get("status"), where = status && status !== "all" ? eq(events.status, status) : undefined;
    const [items, [total], [published], [upcoming]] = await Promise.all([
      db.select({ id: events.id, campusId: events.campusId, title: events.title, description: events.description, game: events.game, capacity: events.capacity, startsAt: events.startsAt, status: events.status, createdAt: events.createdAt, registrationsCount: sql<number>`count(${registrations.userId})` }).from(events).leftJoin(registrations, and(eq(registrations.eventId, events.id), eq(registrations.status, "registered"))).where(where).groupBy(events.id).orderBy(desc(events.startsAt), desc(events.id)).limit(pageSize).offset(offset),
      db.select({ value: count() }).from(events).where(where),
      db.select({ value: count() }).from(events).where(eq(events.status, "published")),
      db.select({ value: count() }).from(events).where(and(eq(events.status, "published"), gt(events.startsAt, new Date()))),
    ]);
    return jsonOk({ ...adminPage(items, total?.value ?? 0, page, pageSize), stats: { published: published?.value ?? 0, upcoming: upcoming?.value ?? 0 } });
  } catch (error) { return jsonError(error); }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request); const admin = await requireAdminFromRequest(request, ["super_admin", "event_manager"]);
    const body = await readJson<{ campusId?: string; title?: string; description?: string; game?: string; capacity?: number | null; startsAt?: string; status?: string }>(request);
    if (typeof body.title !== "string" || body.title.trim().length < 3 || body.title.length > 160 || typeof body.description !== "string" || !body.description.trim() || body.description.length > 5000 || typeof body.startsAt !== "string" || typeof body.campusId !== "string") throw new ApiError(400, "invalid_event", "Select a college and provide a title, description, and start time.");
    if (body.capacity != null && (!Number.isInteger(body.capacity) || body.capacity < 1 || body.capacity > 100000)) throw new ApiError(400, "invalid_capacity", "Capacity must be a whole number between 1 and 100,000.");
    if (!["draft", "published"].includes(body.status ?? "draft") || (body.game && !["None", "Chess", "Other", "chess"].includes(body.game))) throw new ApiError(400, "invalid_event", "Select a valid event status and game.");
    const db = getDb(), [campus] = await db.select({ id: campuses.id }).from(campuses).where(and(eq(campuses.id, body.campusId), eq(campuses.status, "active"))).limit(1);
    if (!campus) throw new ApiError(409, "campus_required", "Select an active approved college.");
    const startsAt = new Date(body.startsAt);
    if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() < Date.now() - 60_000) throw new ApiError(400, "invalid_date", "Choose a future start date and time.");
    const id = crypto.randomUUID(), now = new Date();
    await db.batch([db.insert(events).values({ id, campusId: campus.id, title: body.title.trim(), description: body.description.trim(), game: !body.game || body.game === "None" ? null : body.game.toLowerCase(), capacity: body.capacity ?? null, startsAt, status: body.status ?? "draft", createdAt: now, updatedAt: now }), adminAuditStatement({ adminId: admin.id, action: "event.create", targetType: "event", targetId: id, campusId: campus.id })]);
    return jsonOk({ id }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
