import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { voiceParticipants, voiceRooms } from "@/db/schema";
import { ApiError, jsonError, jsonOk } from "@/lib/api";
import { requireAdminFromRequest } from "@/lib/admin-auth";
import { requireSameOrigin } from "@/lib/admin-api";
import { adminAuditStatement } from "@/lib/admin-audit";
type Context = { params: Promise<{ roomId: string }> };
export async function DELETE(request: Request, { params }: Context) {
  try {
    requireSameOrigin(request); const admin = await requireAdminFromRequest(request, ["super_admin", "moderator"]); const { roomId } = await params, db = getDb(), now = new Date();
    const [room] = await db.select().from(voiceRooms).where(eq(voiceRooms.id, roomId)).limit(1);
    if (!room) throw new ApiError(404, "not_found", "Room not found.");
    if (room.providerRoomId) throw new ApiError(503, "audio_provider_required", "Close this room through the configured audio provider. Provider termination is not integrated.");
    await db.batch([db.update(voiceRooms).set({ status: "ended", endedAt: now, updatedAt: now }).where(eq(voiceRooms.id, roomId)), db.update(voiceParticipants).set({ leftAt: now }).where(eq(voiceParticipants.roomId, roomId)), adminAuditStatement({ adminId: admin.id, action: "voice_room.end", targetType: "voice_room", targetId: roomId, campusId: room.campusId })]);
    return jsonOk({ ended: true });
  } catch (error) { return jsonError(error); }
}
