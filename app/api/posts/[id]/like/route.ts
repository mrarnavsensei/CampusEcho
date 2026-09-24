import { sql } from "drizzle-orm";
import { jsonError, jsonOk } from "@/lib/api";
import { execute, mutationUser, one, visiblePost } from "@/lib/social";
type Context = { params: Promise<{ id: string }> };
async function change(request: Request, { params }: Context, liked: boolean) {
  try { const user = await mutationUser(request, "like", 120), { id } = await params; await visiblePost(user, id); if (liked) await execute(sql`INSERT OR IGNORE INTO post_likes(post_id,user_id,created_at) VALUES(${id},${user.id},${Date.now()})`); else await execute(sql`DELETE FROM post_likes WHERE post_id=${id} AND user_id=${user.id}`); const count = await one<{ likes: number }>(sql`SELECT count(*) AS likes FROM post_likes WHERE post_id=${id}`); return jsonOk({ liked, likes: count?.likes ?? 0 }); } catch (error) { return jsonError(error); }
}
export const PUT = (request: Request, context: Context) => change(request, context, true);
export const DELETE = (request: Request, context: Context) => change(request, context, false);
