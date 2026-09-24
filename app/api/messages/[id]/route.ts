import { sql } from "drizzle-orm";
import { ApiError, jsonError, jsonOk } from "@/lib/api";
import { requireFeature } from "@/lib/security";
import { conversationAccess, execute, mutationUser, one } from "@/lib/social";
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const user = await mutationUser(request, "message_delete", 30); await requireFeature("direct_messages_enabled"); const { id } = await params; const message = await one<{ conversation_id: string }>(sql`SELECT conversation_id FROM messages WHERE id=${id} AND sender_id=${user.id}`); if (!message) throw new ApiError(404, "not_found", "Message not found."); await conversationAccess(user, message.conversation_id); await execute(sql`UPDATE messages SET body='',status='deleted',deleted_at=${Date.now()} WHERE id=${id} AND sender_id=${user.id}`); return jsonOk({ deleted: true }); } catch (error) { return jsonError(error); }
}
