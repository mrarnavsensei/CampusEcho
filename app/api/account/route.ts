import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLogs, sessions, users } from "@/db/schema";
import { ApiError, jsonError, jsonOk, readJson, requireApiUser } from "@/lib/api";
import { studentCookie } from "@/lib/student-auth";

export async function DELETE(request: Request) {
  try {
    const user = await requireApiUser(request);
    const body = await readJson<{ confirmation?: string }>(request);
    if (body.confirmation !== "DELETE") throw new ApiError(422, "confirmation_required", "Type DELETE to request account deletion.");
    const now = new Date(), db = getDb();
    await db.batch([
      db.update(users).set({ status: "deactivated", deletedAt: now, updatedAt: now }).where(eq(users.id, user.id)),
      db.update(sessions).set({ revokedAt: now }).where(eq(sessions.userId, user.id)),
      db.insert(auditLogs).values({ id: crypto.randomUUID(), campusId: user.campusId, actorId: user.id, action: "account.deletion_requested", targetType: "user", targetId: user.id, metadata: JSON.stringify({ status: "pending_retention_review" }), createdAt: now }),
    ]);
    const response = jsonOk({ deactivated: true, deletionStatus: "pending_retention_review" });
    response.headers.append("Set-Cookie", studentCookie("", request, 0));
    response.headers.append("Set-Cookie", "__sites_local_auth=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
    return response;
  } catch (error) { return jsonError(error); }
}
