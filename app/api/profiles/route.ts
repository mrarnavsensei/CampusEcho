import { sql } from "drizzle-orm";
import { jsonError, jsonOk, requireApiUser } from "@/lib/api";
import { blockClause, pagination, page, publicPerson, query, type PersonRow } from "@/lib/social";
export async function GET(request: Request) {
  try {
    const user = await requireApiUser(request), { params, limit, cursor } = pagination(request), term = (params.get("q") || "").toLowerCase().slice(0, 100);
    const result = page(await query<PersonRow & { created_at: number }>(sql`SELECT u.id,u.email_verified_at,u.created_at,p.handle,p.display_name,CASE WHEN p.is_private=0 OR u.id=${user.id} THEN p.bio ELSE '' END AS bio,p.is_private FROM users u JOIN profiles p ON p.user_id=u.id WHERE u.campus_id=${user.campusId} AND u.status='active' AND u.deleted_at IS NULL AND u.email_verified_at IS NOT NULL AND ${blockClause(user, sql`u.id`)} AND (instr(lower(p.handle),${term})>0 OR instr(lower(p.display_name),${term})>0) ${cursor ? sql`AND (u.created_at<${cursor.time} OR (u.created_at=${cursor.time} AND u.id<${cursor.id}))` : sql``} ORDER BY u.created_at DESC,u.id DESC LIMIT ${limit + 1}`), limit);
    return jsonOk({ items: result.rows.map(publicPerson), nextCursor: result.nextCursor });
  } catch (error) { return jsonError(error); }
}
