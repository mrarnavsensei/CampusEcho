import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { conversationMembers, conversations } from "@/db/schema";
import { ApiError, jsonError, jsonOk, readJson, requireApiUser } from "@/lib/api";
import { hashToken } from "@/lib/password";
import { requireFeature } from "@/lib/security";
import { blockClause, eligiblePerson, iso, mutationUser, page, pagination, publicPerson, query, textInput, type PersonRow } from "@/lib/social";
export async function GET(request: Request) {
  try {
    const user = await requireApiUser(request); await requireFeature("direct_messages_enabled");
    const { limit, cursor } = pagination(request);
    const selectedId = new URL(request.url).searchParams.get("id");
    const result = page(await query<PersonRow & { other_id: string; created_at: number; last_message: string | null; last_message_at: number | null; unread: number; blocked: number }>(sql`SELECT c.id,u.id AS other_id,p.handle,p.display_name,CASE WHEN p.is_private=0 THEN p.bio ELSE '' END AS bio,p.is_private,u.email_verified_at,
      coalesce(c.last_message_at,c.created_at) AS created_at,c.last_message_at,
      (SELECT CASE WHEN x.deleted_at IS NULL THEN x.body ELSE 'Message deleted' END FROM messages x WHERE x.conversation_id=c.id ORDER BY x.created_at DESC,x.id DESC LIMIT 1) AS last_message,
      (SELECT count(*) FROM messages x WHERE x.conversation_id=c.id AND x.sender_id<>${user.id} AND x.deleted_at IS NULL AND x.created_at>coalesce(m.last_read_at,0)) AS unread,
      CASE WHEN ${blockClause(user, sql`u.id`)} AND u.status='active' AND u.deleted_at IS NULL THEN 0 ELSE 1 END AS blocked
      FROM conversations c JOIN conversation_members m ON m.conversation_id=c.id AND m.user_id=${user.id} JOIN conversation_members o ON o.conversation_id=c.id AND o.user_id<>${user.id} JOIN users u ON u.id=o.user_id JOIN profiles p ON p.user_id=u.id
      WHERE c.campus_id=${user.campusId} ${selectedId ? sql`AND c.id=${selectedId}` : sql``} ${cursor ? sql`AND (coalesce(c.last_message_at,c.created_at)<${cursor.time} OR (coalesce(c.last_message_at,c.created_at)=${cursor.time} AND c.id<${cursor.id}))` : sql``}
      ORDER BY coalesce(c.last_message_at,c.created_at) DESC,c.id DESC LIMIT ${limit + 1}`), limit);
    return jsonOk({ items: result.rows.map(row => ({ id: row.id, other: publicPerson({ ...row, id: row.other_id }), lastMessage: row.blocked ? null : row.last_message, lastMessageAt: iso(row.last_message_at), unread: row.blocked ? 0 : row.unread, blocked: !!row.blocked })), nextCursor: result.nextCursor });
  } catch (error) { return jsonError(error); }
}
export async function POST(request: Request) {
  try {
    const user = await mutationUser(request, "conversation", 15); await requireFeature("direct_messages_enabled");
    const input = await readJson<{ userId?: unknown }>(request), targetId = textInput(input.userId, "Recipient", 150);
    if (targetId === user.id) throw new ApiError(422, "self_message", "Choose another student to message.");
    const target = await eligiblePerson(user, targetId);
    if (target.is_private) {
      const follows = await query(sql`SELECT 1 FROM follows WHERE follower_id=${user.id} AND followed_id=${targetId}`);
      if (!follows.length) throw new ApiError(403, "private_profile", "This student accepts messages from existing followers only.");
    }
    const id = await hashToken(JSON.stringify([user.campusId, ...[user.id, targetId].sort()])), now = new Date(), db = getDb();
    await db.batch([db.insert(conversations).values({ id, campusId: user.campusId, createdAt: now, updatedAt: now }).onConflictDoNothing(), db.insert(conversationMembers).values([{ conversationId: id, userId: user.id, joinedAt: now }, { conversationId: id, userId: targetId, joinedAt: now }]).onConflictDoNothing()]);
    return jsonOk({ id }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
