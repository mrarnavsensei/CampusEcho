import { sql } from "drizzle-orm";
import { ApiError, jsonError, jsonOk, readJson, requireApiUser } from "@/lib/api";
import { execute, iso, mutationUser, one, page, pagination, query } from "@/lib/social";

export async function GET(request: Request) {
  try { const user = await requireApiUser(request), { limit, cursor } = pagination(request); const result = page(await query<{ id: string; body: string; type: string; entity_id: string | null; read_at: number | null; created_at: number }>(sql`SELECT id,body,type,entity_id,read_at,created_at FROM notifications WHERE user_id=${user.id} ${cursor ? sql`AND (created_at<${cursor.time} OR (created_at=${cursor.time} AND id<${cursor.id}))` : sql``} ORDER BY created_at DESC,id DESC LIMIT ${limit + 1}`), limit); const unread = await one<{ total: number }>(sql`SELECT count(*) AS total FROM notifications WHERE user_id=${user.id} AND read_at IS NULL`); return jsonOk({ items: result.rows.map(row => ({ id: row.id, body: row.body, type: row.type, entityId: row.entity_id, readAt: iso(row.read_at), createdAt: iso(row.created_at) })), nextCursor: result.nextCursor, unread: unread?.total ?? 0 }); } catch (error) { return jsonError(error); }
}
export async function PATCH(request: Request) {
  try {
    const user = await mutationUser(request, "notification_read", 120), input = await readJson<{ ids?: unknown }>(request);
    if (!Array.isArray(input.ids) || !input.ids.length || input.ids.length > 100 || input.ids.some(id => typeof id !== "string" || id.length > 150)) throw new ApiError(422, "invalid_notifications", "Choose between 1 and 100 notification IDs to mark as read.");
    const ids = [...new Set(input.ids as string[])];
    await execute(sql`UPDATE notifications SET read_at=${Date.now()} WHERE user_id=${user.id} AND read_at IS NULL AND id IN (${sql.join(ids.map(id => sql`${id}`), sql`,`)})`);
    const unread = await one<{ total: number }>(sql`SELECT count(*) AS total FROM notifications WHERE user_id=${user.id} AND read_at IS NULL`);
    return jsonOk({ unread: unread?.total ?? 0 });
  } catch (error) { return jsonError(error); }
}
