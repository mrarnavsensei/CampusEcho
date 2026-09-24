import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { blocks, follows } from "@/db/schema";
import { and, eq, or } from "drizzle-orm";
import { ApiError, jsonError, jsonOk } from "@/lib/api";
import { eligiblePerson, execute, mutationUser } from "@/lib/social";
type Context = { params: Promise<{ id: string }> };
export async function PUT(request: Request, { params }: Context) {
  try { const user = await mutationUser(request, "block", 30), { id } = await params; if (id === user.id) throw new ApiError(422, "self_block", "You cannot block yourself."); await eligiblePerson(user, id, true); const db = getDb(); await db.batch([db.insert(blocks).values({ blockerId: user.id, blockedId: id, createdAt: new Date() }).onConflictDoNothing(), db.delete(follows).where(or(and(eq(follows.followerId, user.id), eq(follows.followedId, id)), and(eq(follows.followedId, user.id), eq(follows.followerId, id))))]); return jsonOk({ blocked: true }); } catch (error) { return jsonError(error); }
}
export async function DELETE(request: Request, { params }: Context) { try { const user = await mutationUser(request, "block", 30), { id } = await params; await execute(sql`DELETE FROM blocks WHERE blocker_id=${user.id} AND blocked_id=${id}`); return jsonOk({ blocked: false }); } catch (error) { return jsonError(error); } }
