import { and, count, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { campuses, voiceParticipants, voiceRooms } from "@/db/schema";
import { jsonError, jsonOk } from "@/lib/api";
import { requireAdminFromRequest } from "@/lib/admin-auth";
import { adminPage, adminPagination } from "@/lib/admin-api";
export async function GET(request: Request) {
  try {
    await requireAdminFromRequest(request, ["super_admin", "moderator"]); const db = getDb();
    const { params, page, pageSize, offset } = adminPagination(request);
    const where = params.get("status") === "live" ? eq(voiceRooms.status, "live") : undefined;
    const [rooms, [total], [active], [today], [participants]] = await Promise.all([
      db.select({ id: voiceRooms.id, title: voiceRooms.title, topic: voiceRooms.topic, status: voiceRooms.status, createdAt: voiceRooms.createdAt, campus: campuses.name, participantsCount: sql<number>`count(${voiceParticipants.userId})` }).from(voiceRooms).leftJoin(campuses, eq(campuses.id, voiceRooms.campusId)).leftJoin(voiceParticipants, and(eq(voiceParticipants.roomId, voiceRooms.id), isNull(voiceParticipants.leftAt))).where(where).groupBy(voiceRooms.id).orderBy(desc(voiceRooms.createdAt), desc(voiceRooms.id)).limit(pageSize).offset(offset),
      db.select({ value: count() }).from(voiceRooms).where(where),
      db.select({ value: count() }).from(voiceRooms).where(eq(voiceRooms.status, "live")),
      db.select({ value: count() }).from(voiceRooms).where(gte(voiceRooms.createdAt, new Date(Date.now() - 86400000))),
      db.select({ value: count() }).from(voiceParticipants).innerJoin(voiceRooms, eq(voiceRooms.id, voiceParticipants.roomId)).where(and(eq(voiceRooms.status, "live"), isNull(voiceParticipants.leftAt))),
    ]);
    return jsonOk({ ...adminPage(rooms, total?.value ?? 0, page, pageSize), rooms, audioAvailable: false, stats: { activeRooms: active?.value ?? 0, totalRooms: today?.value ?? 0, totalParticipants: participants?.value ?? 0 } });
  } catch (error) { return jsonError(error); }
}
