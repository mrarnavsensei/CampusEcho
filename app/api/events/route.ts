import { sql } from "drizzle-orm";
import { jsonError, jsonOk, requireApiUser } from "@/lib/api";
import { requireFeature } from "@/lib/security";
import { iso, page, pagination, query } from "@/lib/social";
export async function GET(request: Request) {
  try {
    const user = await requireApiUser(request); await requireFeature("events_enabled"); const { limit, cursor } = pagination(request);
    const result = page(await query<{ id: string; title: string; description: string; game: string | null; capacity: number | null; starts_at: number; created_at: number; status: string; registered: number; registrations: number }>(sql`SELECT e.id,e.title,e.description,e.game,e.capacity,e.starts_at,e.created_at,e.status,EXISTS(SELECT 1 FROM registrations r WHERE r.event_id=e.id AND r.user_id=${user.id} AND r.status='registered') AS registered,(SELECT count(*) FROM registrations r WHERE r.event_id=e.id AND r.status='registered') AS registrations FROM events e WHERE e.campus_id=${user.campusId} AND e.status IN ('published','ongoing','completed') ${cursor ? sql`AND (e.created_at<${cursor.time} OR (e.created_at=${cursor.time} AND e.id<${cursor.id}))` : sql``} ORDER BY e.created_at DESC,e.id DESC LIMIT ${limit + 1}`), limit);
    return jsonOk({ items: result.rows.map(row => ({ id: row.id, title: row.title, description: row.description, game: row.game, capacity: row.capacity, startsAt: iso(row.starts_at), status: row.status, registered: !!row.registered, registrations: row.registrations })), nextCursor: result.nextCursor });
  } catch (error) { return jsonError(error); }
}
