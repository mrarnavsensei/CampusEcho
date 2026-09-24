import { sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { ApiError, type ApiUser, requireApiUser } from "@/lib/api";
import { consumeRateLimit, enforceSameOrigin } from "@/lib/security";
import type { PublicPerson, SocialPost, SocialProfile } from "@/lib/social-types";

export const query = <T = Record<string, unknown>>(statement: SQL) => getDb().all<T>(statement);
export async function one<T = Record<string, unknown>>(statement: SQL) { return (await query<T>(statement))[0]; }
export const execute = (statement: SQL) => getDb().run(statement);
export const iso = (value: number | null) => value === null ? null : new Date(value).toISOString();
export async function mutationUser(request: Request, action: string, limit = 60) {
  enforceSameOrigin(request);
  const user = await requireApiUser(request);
  await consumeRateLimit(`social:${action}:${user.id}`, limit, 60_000);
  return user;
}
export function textInput(value: unknown, field: string, max: number, min = 1) {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) throw new ApiError(422, "invalid_input", `${field} must contain ${min}–${max} characters.`);
  return value.trim();
}
export function pagination(request: Request, max = 50) {
  const params = new URL(request.url).searchParams;
  const parsed = Number(params.get("limit") || 20);
  const limit = Number.isFinite(parsed) ? Math.max(1, Math.min(max, Math.floor(parsed))) : 20;
  const raw = params.get("cursor");
  let cursor: { time: number; id: string } | null = null;
  if (raw) {
    try {
      const [time, id] = JSON.parse(atob(raw)) as unknown[];
      if (typeof time !== "number" || !Number.isSafeInteger(time) || time < 0 || typeof id !== "string" || id.length > 200) throw new Error();
      cursor = { time, id };
    } catch { throw new ApiError(422, "invalid_cursor", "The page cursor is invalid. Refresh this list."); }
  }
  return { params, limit, cursor };
}
export const cursorFor = (row: { created_at: number; id: string }) => btoa(JSON.stringify([row.created_at, row.id]));
export function page<T extends { created_at: number; id: string }>(items: T[], limit: number) {
  const hasMore = items.length > limit;
  const visible = items.slice(0, limit);
  return { rows: visible, nextCursor: hasMore ? cursorFor(visible[visible.length - 1]) : null };
}
export function blockClause(viewer: ApiUser, author: SQL) {
  return sql`NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = ${viewer.id} AND b.blocked_id = ${author}) OR (b.blocked_id = ${viewer.id} AND b.blocker_id = ${author}))`;
}
export function postVisibility(viewer: ApiUser) {
  return sql`p.campus_id = ${viewer.campusId} AND p.status = 'published' AND p.moderation_status = 'approved' AND p.deleted_at IS NULL
    AND u.status = 'active' AND u.deleted_at IS NULL AND ${blockClause(viewer, sql`p.author_id`)}
    AND (p.visibility = 'anonymous' OR pr.is_private = 0 OR p.author_id = ${viewer.id} OR EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = ${viewer.id} AND f.followed_id = p.author_id))`;
}
export async function visiblePost(user: ApiUser, id: string) {
  const row = await one<{ id: string; author_id: string; visibility: string; body: string }>(sql`SELECT p.id, p.author_id, p.visibility, p.body FROM posts p JOIN users u ON u.id=p.author_id JOIN profiles pr ON pr.user_id=p.author_id WHERE p.id=${id} AND ${postVisibility(user)} LIMIT 1`);
  if (!row) throw new ApiError(404, "not_found", "Post not found.");
  return row;
}
export type PersonRow = { id: string; handle: string; display_name: string; bio: string; is_private: number; email_verified_at: number | null };
export const publicPerson = (row: PersonRow): PublicPerson => ({ id: row.id, handle: row.handle, displayName: row.display_name, bio: row.bio, isPrivate: !!row.is_private, verified: row.email_verified_at !== null });
export async function eligiblePerson(user: ApiUser, id: string, allowBlocked = false) {
  const person = await one<PersonRow & { campus_id: string }>(sql`SELECT u.id,u.campus_id,u.email_verified_at,pr.handle,pr.display_name,pr.bio,pr.is_private FROM users u JOIN profiles pr ON pr.user_id=u.id WHERE u.id=${id} AND u.campus_id=${user.campusId} AND u.status='active' AND u.deleted_at IS NULL AND u.email_verified_at IS NOT NULL ${allowBlocked ? sql`` : sql`AND ${blockClause(user, sql`u.id`)}`} LIMIT 1`);
  if (!person) throw new ApiError(404, "not_found", "Student not found.");
  return person;
}
export async function readProfile(user: ApiUser, id: string): Promise<SocialProfile> {
  const person = await eligiblePerson(user, id, true);
  const extra = await one<{ campus_name: string; anonymous_by_default: number; followers: number; following: number; is_following: number; is_blocked: number; blocked_by: number }>(sql`SELECT c.name AS campus_name,p.anonymous_by_default,
    (SELECT count(*) FROM follows WHERE followed_id=${id}) AS followers,(SELECT count(*) FROM follows WHERE follower_id=${id}) AS following,
    EXISTS(SELECT 1 FROM follows WHERE follower_id=${user.id} AND followed_id=${id}) AS is_following,
    EXISTS(SELECT 1 FROM blocks WHERE blocker_id=${user.id} AND blocked_id=${id}) AS is_blocked,
    EXISTS(SELECT 1 FROM blocks WHERE blocker_id=${id} AND blocked_id=${user.id}) AS blocked_by
    FROM profiles p JOIN campuses c ON c.id=${user.campusId} WHERE p.user_id=${id}`);
  if (!extra || extra.blocked_by) throw new ApiError(404, "not_found", "Student not found.");
  const isOwn = user.id === id;
  const canViewPosts = !extra.is_blocked && (isOwn || !person.is_private || !!extra.is_following);
  return { ...publicPerson(person), bio: canViewPosts ? person.bio : "", campusId: user.campusId, campusName: extra.campus_name, anonymousByDefault: isOwn ? !!extra.anonymous_by_default : true, followers: extra.followers, following: extra.following, isFollowing: !!extra.is_following, isBlocked: !!extra.is_blocked, isOwn, canViewPosts };
}
type PostRow = PersonRow & { author_id: string; alias: string | null; visibility: "anonymous" | "profile"; body: string; kind: string; created_at: number; edited_at: number | null; likes: number; liked: number; comments: number; saved: number; poll_id: string | null; closes_at: number | null; voted_option_id: string | null };
export async function readPosts(user: ApiUser, where: SQL, limit: number): Promise<Array<SocialPost & { created_at: number }>> {
  const rows = await query<PostRow>(sql`SELECT p.id,p.author_id,p.alias,p.visibility,p.body,p.kind,p.created_at,p.edited_at,
    pr.handle,pr.display_name,pr.bio,pr.is_private,u.email_verified_at,
    (SELECT count(*) FROM post_likes l WHERE l.post_id=p.id) AS likes,
    EXISTS(SELECT 1 FROM post_likes l WHERE l.post_id=p.id AND l.user_id=${user.id}) AS liked,
    (SELECT count(*) FROM comments c JOIN users cu ON cu.id=c.author_id WHERE c.post_id=p.id AND c.status='published' AND c.deleted_at IS NULL AND cu.status='active' AND cu.deleted_at IS NULL AND ${blockClause(user, sql`c.author_id`)}) AS comments,
    EXISTS(SELECT 1 FROM bookmarks b WHERE b.post_id=p.id AND b.user_id=${user.id}) AS saved,
    po.id AS poll_id,po.closes_at,(SELECT v.option_id FROM poll_votes v WHERE v.poll_id=po.id AND v.user_id=${user.id}) AS voted_option_id
    FROM posts p JOIN users u ON u.id=p.author_id JOIN profiles pr ON pr.user_id=p.author_id LEFT JOIN polls po ON po.post_id=p.id
    WHERE ${postVisibility(user)} AND ${where} ORDER BY p.created_at DESC,p.id DESC LIMIT ${limit}`);
  const pollIds = rows.flatMap(row => row.poll_id ? [row.poll_id] : []);
  const options = pollIds.length ? await query<{ id: string; poll_id: string; label: string; votes: number }>(sql`SELECT o.id,o.poll_id,o.label,(SELECT count(*) FROM poll_votes v WHERE v.option_id=o.id) AS votes FROM poll_options o WHERE o.poll_id IN (${sql.join(pollIds.map(id => sql`${id}`), sql`,`)}) ORDER BY o.position`) : [];
  // Older builds derived aliases from public account IDs. Never expose those legacy aliases.
  return rows.map(row => ({ id: row.id, alias: row.visibility === "anonymous" ? (/^Anonymous Echo [a-f0-9]{8}$/.test(row.alias || "") ? row.alias : "Anonymous Echo") : null, visibility: row.visibility, body: row.body, kind: row.kind, createdAt: iso(row.created_at)!, created_at: row.created_at, editedAt: iso(row.edited_at), author: row.visibility === "anonymous" ? null : publicPerson({ ...row, id: row.author_id }), isOwn: row.author_id === user.id, likes: row.likes, liked: !!row.liked, comments: row.comments, saved: !!row.saved, poll: row.poll_id ? { id: row.poll_id, closesAt: iso(row.closes_at), options: options.filter(option => option.poll_id === row.poll_id).map(({ id, label, votes }) => ({ id, label, votes })), votedOptionId: row.voted_option_id } : null }));
}
export async function notify(userId: string, type: string, entityId: string, body: string) {
  await execute(sql`INSERT INTO notifications(id,user_id,actor_id,type,entity_id,body,created_at) VALUES(${crypto.randomUUID()},${userId},NULL,${type},${entityId},${body},${Date.now()})`);
}
export async function conversationAccess(user: ApiUser, id: string) {
  const member = await one<{ id: string; other_id: string; last_read_at: number | null; other_read_at: number | null }>(sql`SELECT c.id,o.user_id AS other_id,m.last_read_at,o.last_read_at AS other_read_at FROM conversations c JOIN conversation_members m ON m.conversation_id=c.id AND m.user_id=${user.id} JOIN conversation_members o ON o.conversation_id=c.id AND o.user_id<>${user.id} WHERE c.id=${id} AND c.campus_id=${user.campusId} LIMIT 1`);
  if (!member) throw new ApiError(404, "not_found", "Conversation not found.");
  await eligiblePerson(user, member.other_id);
  return member;
}
