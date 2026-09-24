import { sql } from "drizzle-orm";
import { ApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { requireFeature } from "@/lib/security";
import { conversationAccess, execute, mutationUser, one } from "@/lib/social";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await mutationUser(request, "message_read", 120); await requireFeature("direct_messages_enabled"); const { id } = await params;
    await conversationAccess(user, id);
    const input = request.body ? await readJson<{ messageId?: unknown }>(request) : {};
    if (input.messageId !== undefined && (typeof input.messageId !== "string" || !input.messageId || input.messageId.length > 150)) throw new ApiError(422, "invalid_message", "Choose a valid message to mark as read.");
    const latest = typeof input.messageId === "string" ? await one<{ created_at: number }>(sql`SELECT created_at FROM messages WHERE id=${input.messageId} AND conversation_id=${id}`) : await one<{ created_at: number }>(sql`SELECT max(created_at) AS created_at FROM messages WHERE conversation_id=${id}`);
    if (input.messageId !== undefined && !latest) throw new ApiError(404, "not_found", "Message not found in this conversation.");
    if (latest?.created_at) await execute(sql`UPDATE conversation_members SET last_read_at=max(coalesce(last_read_at,0),${latest.created_at}) WHERE conversation_id=${id} AND user_id=${user.id}`);
    const unread = await one<{ total: number }>(sql`SELECT count(*) AS total FROM messages WHERE conversation_id=${id} AND sender_id<>${user.id} AND deleted_at IS NULL AND created_at>coalesce((SELECT last_read_at FROM conversation_members WHERE conversation_id=${id} AND user_id=${user.id}),0)`);
    return jsonOk({ unread: unread?.total ?? 0 });
  } catch (error) { return jsonError(error); }
}
