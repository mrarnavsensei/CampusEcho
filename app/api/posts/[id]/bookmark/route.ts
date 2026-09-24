import { sql } from "drizzle-orm";
import { jsonError, jsonOk } from "@/lib/api";
import { execute, mutationUser, visiblePost } from "@/lib/social";
type Context = { params: Promise<{ id: string }> };
async function change(request: Request, { params }: Context, saved: boolean) {
  try { const user = await mutationUser(request, "bookmark", 120), { id } = await params; await visiblePost(user, id); if (saved) await execute(sql`INSERT OR IGNORE INTO bookmarks(post_id,user_id,created_at) VALUES(${id},${user.id},${Date.now()})`); else await execute(sql`DELETE FROM bookmarks WHERE post_id=${id} AND user_id=${user.id}`); return jsonOk({ saved }); } catch (error) { return jsonError(error); }
}
export const PUT = (request: Request, context: Context) => change(request, context, true);
export const DELETE = (request: Request, context: Context) => change(request, context, false);
