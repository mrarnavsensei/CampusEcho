import { sql } from "drizzle-orm";
import { ApiError, jsonError, jsonOk, readJson, requireApiUser } from "@/lib/api";
import { moderateText } from "@/lib/moderation";
import { execute, mutationUser, one, query, readPosts, textInput } from "@/lib/social";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  try { const user = await requireApiUser(request); const { id } = await params; const [post] = await readPosts(user, sql`p.id=${id}`, 1); if (!post) throw new ApiError(404, "not_found", "Post not found."); const { created_at, ...item } = post; void created_at; return jsonOk(item); } catch (error) { return jsonError(error); }
}
export async function PATCH(request: Request, { params }: Context) {
  try {
    const user = await mutationUser(request, "post_edit", 20), { id } = await params;
    const owned = await one(sql`SELECT id FROM posts WHERE id=${id} AND author_id=${user.id} AND campus_id=${user.campusId} AND deleted_at IS NULL AND status IN ('published','pending')`);
    if (!owned) throw new ApiError(404, "not_found", "Post not found.");
    const input = await readJson<{ body?: unknown }>(request), body = textInput(input.body, "Post", 500);
    const options = await query<{ label: string }>(sql`SELECT o.label FROM poll_options o JOIN polls p ON p.id=o.poll_id WHERE p.post_id=${id}`);
    const result = await moderateText([body, ...options.map(option => option.label)].join("\n")), now = Date.now();
    const update = await execute(sql`UPDATE posts SET body=${body},status=${result.allowed ? "published" : "pending"},moderation_status=${result.status},edited_at=${now},updated_at=${now} WHERE id=${id} AND author_id=${user.id} AND deleted_at IS NULL AND status IN ('published','pending')`);
    if (!update.meta.changes) throw new ApiError(409, "post_changed", "This post was removed while you were editing it.");
    await execute(sql`INSERT INTO moderation_decisions(id,campus_id,subject_type,subject_id,provider,outcome,categories,reason,created_at) VALUES(${crypto.randomUUID()},${user.campusId},'post',${id},${result.provider},${result.status},${JSON.stringify(result.categories)},${result.reason},${now})`);
    return jsonOk({ id, status: result.allowed ? "published" : "pending" });
  } catch (error) { return jsonError(error); }
}
export async function DELETE(request: Request, { params }: Context) {
  try { const user = await mutationUser(request, "post_delete"), { id } = await params, now = Date.now(); const result = await execute(sql`UPDATE posts SET deleted_at=${now},updated_at=${now},status='deleted' WHERE id=${id} AND author_id=${user.id} AND campus_id=${user.campusId} AND deleted_at IS NULL`); if (!result.meta.changes) throw new ApiError(404, "not_found", "Post not found."); return jsonOk({ deleted: true }); } catch (error) { return jsonError(error); }
}
