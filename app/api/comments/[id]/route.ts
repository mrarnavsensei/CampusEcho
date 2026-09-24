import { sql } from "drizzle-orm";
import { ApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { moderateText } from "@/lib/moderation";
import { execute, mutationUser, one, textInput, visiblePost } from "@/lib/social";
type Context = { params: Promise<{ id: string }> };
async function owned(request: Request, context: Context) {
  const user = await mutationUser(request, "comment_edit", 30), { id } = await context.params;
  const comment = await one<{ post_id: string }>(sql`SELECT post_id FROM comments WHERE id=${id} AND author_id=${user.id} AND deleted_at IS NULL AND status='published'`);
  if (!comment) throw new ApiError(404, "not_found", "Comment not found.");
  await visiblePost(user, comment.post_id);
  return { user, id };
}
export async function PATCH(request: Request, context: Context) { try { const { user, id } = await owned(request, context); const input = await readJson<{ body?: unknown }>(request), body = textInput(input.body, "Comment", 1000), result = await moderateText(body); if (!result.allowed) throw new ApiError(422, "moderation_required", result.reason); const update = await execute(sql`UPDATE comments SET body=${body},updated_at=${Date.now()} WHERE id=${id} AND author_id=${user.id} AND status='published' AND deleted_at IS NULL`); if (!update.meta.changes) throw new ApiError(409, "comment_changed", "This comment was removed while you were editing it."); return jsonOk({ updated: true }); } catch (error) { return jsonError(error); } }
export async function DELETE(request: Request, context: Context) { try { const { user, id } = await owned(request, context); await execute(sql`UPDATE comments SET status='deleted',deleted_at=${Date.now()},updated_at=${Date.now()} WHERE id=${id} AND author_id=${user.id}`); return jsonOk({ deleted: true }); } catch (error) { return jsonError(error); } }
