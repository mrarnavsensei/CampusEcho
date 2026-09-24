import { sql } from "drizzle-orm";
import { ApiError, jsonError, jsonOk } from "@/lib/api";
import { eligiblePerson, execute, mutationUser, readProfile } from "@/lib/social";
type Context = { params: Promise<{ id: string }> };
export async function PUT(request: Request, { params }: Context) {
  try { const user = await mutationUser(request, "follow", 30), { id } = await params; if (id === user.id) throw new ApiError(422, "self_follow", "You cannot follow yourself."); const other = await eligiblePerson(user, id); if (other.is_private) throw new ApiError(403, "private_profile", "This profile is private and is not accepting new followers."); await execute(sql`INSERT OR IGNORE INTO follows(follower_id,followed_id,created_at) VALUES(${user.id},${id},${Date.now()})`); return jsonOk(await readProfile(user, id)); } catch (error) { return jsonError(error); }
}
export async function DELETE(request: Request, { params }: Context) {
  try { const user = await mutationUser(request, "follow", 30), { id } = await params; await eligiblePerson(user, id); await execute(sql`DELETE FROM follows WHERE follower_id=${user.id} AND followed_id=${id}`); return jsonOk(await readProfile(user, id)); } catch (error) { return jsonError(error); }
}
