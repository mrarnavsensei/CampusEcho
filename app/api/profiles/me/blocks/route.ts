import { sql } from "drizzle-orm";
import { jsonError, jsonOk, requireApiUser } from "@/lib/api";
import { query, publicPerson, type PersonRow } from "@/lib/social";
export async function GET(request: Request) { try { const user = await requireApiUser(request); const rows = await query<PersonRow>(sql`SELECT u.id,u.email_verified_at,p.handle,p.display_name,'' AS bio,p.is_private FROM blocks b JOIN users u ON u.id=b.blocked_id JOIN profiles p ON p.user_id=u.id WHERE b.blocker_id=${user.id} ORDER BY b.created_at DESC LIMIT 100`); return jsonOk({ items: rows.map(publicPerson) }); } catch (error) { return jsonError(error); } }
