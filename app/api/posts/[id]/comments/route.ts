import { sql } from "drizzle-orm";
import { ApiError, jsonError, jsonOk, readJson, requireApiUser } from "@/lib/api";
import { moderateText } from "@/lib/moderation";
import { blockClause, execute, iso, mutationUser, notify, page, pagination, query, textInput, visiblePost } from "@/lib/social";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  try {
    const user = await requireApiUser(request), { id } = await params; await visiblePost(user, id);
    const { limit, cursor } = pagination(request);
    const result = page(await query<{ id: string; body: string; alias: string | null; author_id: string; created_at: number; updated_at: number }>(sql`SELECT c.id,c.body,c.alias,c.author_id,c.created_at,c.updated_at FROM comments c JOIN users u ON u.id=c.author_id WHERE c.post_id=${id} AND c.status='published' AND c.deleted_at IS NULL AND u.status='active' AND u.deleted_at IS NULL AND ${blockClause(user, sql`c.author_id`)} ${cursor ? sql`AND (c.created_at<${cursor.time} OR (c.created_at=${cursor.time} AND c.id<${cursor.id}))` : sql``} ORDER BY c.created_at DESC,c.id DESC LIMIT ${limit + 1}`), limit);
    return jsonOk({ items: result.rows.map(row => ({ id: row.id, body: row.body, alias: row.alias || "Anonymous Echo", author: null, isOwn: row.author_id === user.id, createdAt: iso(row.created_at), editedAt: row.updated_at > row.created_at ? iso(row.updated_at) : null })), nextCursor: result.nextCursor });
  } catch (error) { return jsonError(error); }
}
export async function POST(request: Request, { params }: Context) {
  try {
    const user = await mutationUser(request, "comment", 20), { id } = await params, post = await visiblePost(user, id);
    const input = await readJson<{ body?: unknown }>(request), body = textInput(input.body, "Comment", 1000), moderation = await moderateText(body);
    if (!moderation.allowed) throw new ApiError(422, "moderation_required", moderation.reason);
    const commentId = crypto.randomUUID(), now = Date.now(), alias = `Anonymous Echo ${crypto.randomUUID().slice(0, 8)}`;
    await execute(sql`INSERT INTO comments(id,post_id,author_id,alias,body,status,created_at,updated_at) VALUES(${commentId},${id},${user.id},${alias},${body},'published',${now},${now})`);
    if (post.author_id !== user.id) await notify(post.author_id, "comment", id, "Someone replied to your echo.");
    return jsonOk({ id: commentId, body, alias, author: null, isOwn: true, createdAt: iso(now), editedAt: null }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
