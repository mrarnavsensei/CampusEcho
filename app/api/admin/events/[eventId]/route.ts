import { and, count, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { events, profiles, registrations } from "@/db/schema";
import { ApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { requireAdminFromRequest } from "@/lib/admin-auth";
import { adminPagination, adminPage, requireSameOrigin } from "@/lib/admin-api";
import { adminAuditStatement } from "@/lib/admin-audit";
type Context = { params: Promise<{ eventId: string }> };
export async function GET(request: Request, { params }: Context) {
  try {
    await requireAdminFromRequest(request, ["super_admin", "event_manager"]); const { eventId } = await params, db = getDb();
    const { page, pageSize, offset } = adminPagination(request);
    const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
    if (!event) throw new ApiError(404, "not_found", "Event not found.");
    const where = and(eq(registrations.eventId, eventId), eq(registrations.status, "registered"));
    const [[total], attendees] = await Promise.all([db.select({ value: count() }).from(registrations).where(where), db.select({ id: registrations.userId, handle: profiles.handle, displayName: profiles.displayName, createdAt: registrations.createdAt }).from(registrations).leftJoin(profiles, eq(profiles.userId, registrations.userId)).where(where).orderBy(desc(registrations.createdAt), registrations.userId).limit(pageSize).offset(offset)]);
    return jsonOk({ ...event, registrationsCount: total?.value ?? 0, registrations: adminPage(attendees, total?.value ?? 0, page, pageSize) });
  } catch (error) { return jsonError(error); }
}
export async function PATCH(request: Request, { params }: Context) {
  try {
    requireSameOrigin(request); const admin = await requireAdminFromRequest(request, ["super_admin", "event_manager"]); const { eventId } = await params;
    const body = await readJson<{ title?: string; description?: string; status?: string }>(request);
    if (!body.title && !body.description && !body.status) throw new ApiError(400, "invalid_event", "Provide an event field to update.");
    if ((body.title !== undefined && (typeof body.title !== "string" || body.title.trim().length < 3 || body.title.length > 160)) || (body.description !== undefined && (typeof body.description !== "string" || !body.description.trim() || body.description.length > 5000)) || (body.status && !["draft", "published", "ongoing", "completed", "archived"].includes(body.status))) throw new ApiError(400, "invalid_event", "Provide a valid title, description, and event status.");
    const db = getDb(), [event] = await db.select({ id: events.id, campusId: events.campusId }).from(events).where(eq(events.id, eventId)).limit(1);
    if (!event) throw new ApiError(404, "not_found", "Event not found.");
    await db.batch([db.update(events).set({ ...(body.title ? { title: body.title.trim() } : {}), ...(body.description ? { description: body.description.trim() } : {}), ...(body.status ? { status: body.status } : {}), updatedAt: new Date() }).where(eq(events.id, eventId)), adminAuditStatement({ adminId: admin.id, action: "event.update", targetType: "event", targetId: eventId, campusId: event.campusId, metadata: { status: body.status } })]);
    return jsonOk({ updated: true });
  } catch (error) { return jsonError(error); }
}
export async function DELETE(request: Request, { params }: Context) {
  try {
    requireSameOrigin(request); const admin = await requireAdminFromRequest(request, ["super_admin", "event_manager"]); const { eventId } = await params, db = getDb();
    const [event] = await db.select({ id: events.id }).from(events).where(eq(events.id, eventId)).limit(1);
    if (!event) throw new ApiError(404, "not_found", "Event not found.");
    await db.batch([db.update(events).set({ status: "archived", updatedAt: new Date() }).where(eq(events.id, eventId)), adminAuditStatement({ adminId: admin.id, action: "event.archive", targetType: "event", targetId: eventId })]);
    return jsonOk({ archived: true });
  } catch (error) { return jsonError(error); }
}
