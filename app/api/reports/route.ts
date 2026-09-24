import { sql } from "drizzle-orm";
import { ApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { eligiblePerson, execute, mutationUser, one, textInput, visiblePost } from "@/lib/social";
export async function POST(request: Request) {
  try {
    const user = await mutationUser(request, "report", 10), input = await readJson<{ targetType?: unknown; targetId?: unknown; reason?: unknown; details?: unknown }>(request);
    const targetType = textInput(input.targetType, "Report type", 20), targetId = textInput(input.targetId, "Report target", 150), reason = textInput(input.reason, "Reason", 100), details = input.details === undefined ? "" : textInput(input.details, "Details", 2000, 0);
    if (targetType === "post") await visiblePost(user, targetId);
    else if (targetType === "profile" || targetType === "user") await eligiblePerson(user, targetId, true);
    else if (targetType === "comment") { const comment = await one<{ post_id: string }>(sql`SELECT post_id FROM comments WHERE id=${targetId} AND deleted_at IS NULL AND status='published'`); if (!comment) throw new ApiError(404, "not_found", "Comment not found."); await visiblePost(user, comment.post_id); }
    else if (targetType === "message") { const message = await one(sql`SELECT m.id FROM messages m JOIN conversation_members cm ON cm.conversation_id=m.conversation_id AND cm.user_id=${user.id} JOIN conversations c ON c.id=m.conversation_id WHERE m.id=${targetId} AND c.campus_id=${user.campusId} AND m.deleted_at IS NULL`); if (!message) throw new ApiError(404, "not_found", "Message not found."); }
    else if (targetType === "conversation") { const conversation = await one(sql`SELECT c.id FROM conversations c JOIN conversation_members m ON m.conversation_id=c.id AND m.user_id=${user.id} WHERE c.id=${targetId} AND c.campus_id=${user.campusId}`); if (!conversation) throw new ApiError(404, "not_found", "Conversation not found."); }
    else throw new ApiError(422, "invalid_target", "This content type cannot be reported here.");
    const previous = await one<{ id: string }>(sql`SELECT id FROM reports WHERE reporter_id=${user.id} AND target_type=${targetType} AND target_id=${targetId} AND status IN ('open','reviewing') LIMIT 1`);
    if (previous) return jsonOk({ id: previous.id, status: "open" });
    const id = crypto.randomUUID(), now = Date.now();
    await execute(sql`INSERT INTO reports(id,campus_id,reporter_id,target_type,target_id,reason,details,status,created_at,updated_at) SELECT ${id},${user.campusId},${user.id},${targetType},${targetId},${reason},${details},'open',${now},${now} WHERE NOT EXISTS(SELECT 1 FROM reports WHERE reporter_id=${user.id} AND target_type=${targetType} AND target_id=${targetId} AND status IN ('open','reviewing'))`);
    const saved = await one<{ id: string }>(sql`SELECT id FROM reports WHERE reporter_id=${user.id} AND target_type=${targetType} AND target_id=${targetId} AND status IN ('open','reviewing') ORDER BY created_at DESC LIMIT 1`);
    return jsonOk({ id: saved?.id ?? id, status: "open" }, { status: saved?.id === id ? 201 : 200 });
  } catch (error) { return jsonError(error); }
}
