import { sql } from "drizzle-orm";
import { ApiError, jsonError, jsonOk } from "@/lib/api";
import { requireFeature } from "@/lib/security";
import { execute, mutationUser, one } from "@/lib/social";
type Context = { params: Promise<{ id: string }> };
export async function PUT(request: Request, { params }: Context) {
  try {
    const user = await mutationUser(request, "registration", 20); await requireFeature("events_enabled"); const { id } = await params;
    const event = await one<{ id: string; starts_at: number; status: string }>(sql`SELECT id,starts_at,status FROM events WHERE id=${id} AND campus_id=${user.campusId} AND status IN ('published','ongoing','completed')`);
    if (!event) throw new ApiError(404, "not_found", "Event not found.");
    if (event.status !== "published" || event.starts_at <= Date.now()) throw new ApiError(409, "registration_closed", "Registration for this event has closed.");
    await execute(sql`INSERT OR IGNORE INTO registrations(event_id,user_id,status,created_at) SELECT e.id,${user.id},'registered',${Date.now()} FROM events e WHERE e.id=${id} AND e.campus_id=${user.campusId} AND e.status='published' AND e.starts_at>${Date.now()} AND (e.capacity IS NULL OR (SELECT count(*) FROM registrations r WHERE r.event_id=e.id AND r.status='registered')<e.capacity)`);
    const registered = await one(sql`SELECT event_id FROM registrations WHERE event_id=${id} AND user_id=${user.id} AND status='registered'`);
    if (!registered) throw new ApiError(409, "event_full", "This event is full or registration has closed.");
    return jsonOk({ registered: true });
  } catch (error) { return jsonError(error); }
}
export async function DELETE(request: Request, { params }: Context) {
  try { const user = await mutationUser(request, "registration", 20); await requireFeature("events_enabled"); const { id } = await params; const event = await one<{ starts_at: number; status: string }>(sql`SELECT starts_at,status FROM events WHERE id=${id} AND campus_id=${user.campusId}`); if (!event) throw new ApiError(404, "not_found", "Event not found."); if (event.starts_at <= Date.now()) throw new ApiError(409, "registration_closed", "This event has started. Contact event support for withdrawals."); await execute(sql`DELETE FROM registrations WHERE event_id=${id} AND user_id=${user.id}`); return jsonOk({ registered: false }); } catch (error) { return jsonError(error); }
}
