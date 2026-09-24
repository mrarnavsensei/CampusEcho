import { sql } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { ApiError, jsonError, jsonOk, readJson, requireApiUser } from "@/lib/api";
import { hashToken } from "@/lib/password";
import { requireFeature } from "@/lib/security";
import { conversationAccess, iso, mutationUser, one, page, pagination, query, textInput } from "@/lib/social";
type Context = { params: Promise<{ id: string }> };
type MessageRow = { id: string; body: string; sender_id: string; created_at: number; deleted_at: number | null };
export async function GET(request: Request, { params }: Context) {
  try {
    const user = await requireApiUser(request); await requireFeature("direct_messages_enabled");
    const { id } = await params, member = await conversationAccess(user, id), { limit, cursor } = pagination(request);
    const result = page(await query<MessageRow>(sql`SELECT id,body,sender_id,created_at,deleted_at FROM messages WHERE conversation_id=${id} ${cursor ? sql`AND (created_at<${cursor.time} OR (created_at=${cursor.time} AND id<${cursor.id}))` : sql``} ORDER BY created_at DESC,id DESC LIMIT ${limit + 1}`), limit);
    return jsonOk({ items: result.rows.map(row => ({ id: row.id, body: row.deleted_at ? "" : row.body, senderId: row.sender_id, isOwn: row.sender_id === user.id, createdAt: iso(row.created_at), deleted: row.deleted_at !== null, read: row.sender_id === user.id && (member.other_read_at ?? 0) >= row.created_at })), nextCursor: result.nextCursor, transport: "polling" });
  } catch (error) { return jsonError(error); }
}
export async function POST(request: Request, { params }: Context) {
  try {
    const user = await mutationUser(request, "message", 40); await requireFeature("direct_messages_enabled");
    const { id } = await params, member = await conversationAccess(user, id), input = await readJson<{ body?: unknown; clientId?: unknown }>(request), body = textInput(input.body, "Message", 2000);
    const clientId = input.clientId === undefined ? crypto.randomUUID() : textInput(input.clientId, "Message reference", 100);
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(clientId)) throw new ApiError(422, "invalid_message_id", "Message reference is invalid.");
    const messageId = await hashToken(JSON.stringify([id, user.id, clientId])), now = Date.now();
    if (!env.DB) throw new ApiError(503, "database_unavailable", "Messages are temporarily unavailable.");
    await env.DB.batch([
      env.DB.prepare("INSERT OR IGNORE INTO messages(id,conversation_id,sender_id,body,status,created_at) VALUES(?,?,?,?,'sent',?)").bind(messageId, id, user.id, body, now),
      env.DB.prepare("UPDATE conversations SET last_message_at=(SELECT max(created_at) FROM messages WHERE conversation_id=?),updated_at=? WHERE id=?").bind(id, now, id),
    ]);
    const row = await one<MessageRow>(sql`SELECT id,body,sender_id,created_at,deleted_at FROM messages WHERE id=${messageId}`);
    if (!row) throw new ApiError(500, "message_failed", "Your message could not be saved.");
    return jsonOk({ id: row.id, body: row.deleted_at ? "" : row.body, senderId: user.id, isOwn: true, createdAt: iso(row.created_at), deleted: row.deleted_at !== null, read: (member.other_read_at ?? 0) >= row.created_at }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
