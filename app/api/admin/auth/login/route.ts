import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { adminAccounts } from "@/db/schema";
import { ApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { createAdminSession, makeAdminCookie, verifyPassword } from "@/lib/admin-auth";
import { consumeRateLimit, requestAddress } from "@/lib/security";
import { recordAdminAction } from "@/lib/admin-audit";
import { requireSameOrigin } from "@/lib/admin-api";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    await consumeRateLimit(`admin-login:${requestAddress(request)}`, 10, 15 * 60_000);
    const body = await readJson<{ email?: string; password?: string }>(request);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || email.length > 254 || typeof body.password !== "string" || !body.password || body.password.length > 256) throw new ApiError(400, "invalid_credentials", "Email and password are required.");
    await consumeRateLimit(`admin-login-email:${email}`, 10, 15 * 60_000);
    const [admin] = await getDb().select().from(adminAccounts).where(and(eq(adminAccounts.email, email), eq(adminAccounts.status, "active"))).limit(1);
    const valid = await verifyPassword(body.password, admin?.passwordHash ?? "pbkdf2:sha256:600000:00000000000000000000000000000000:0000000000000000000000000000000000000000000000000000000000000000");
    if (!admin || !valid) {
      await recordAdminAction({ adminId: admin?.id ?? "unknown", action: "admin.login_failed", targetType: "admin_account", targetId: admin?.id, metadata: { success: false } });
      throw new ApiError(401, "invalid_credentials", "Invalid email or password.");
    }
    const now = new Date();
    await getDb().update(adminAccounts).set({ lastLoginAt: now, updatedAt: now }).where(eq(adminAccounts.id, admin.id));
    const session = await createAdminSession(admin.id);
    await recordAdminAction({ adminId: admin.id, action: "admin.login", targetType: "admin_account", targetId: admin.id });
    return jsonOk({ id: admin.id, email: admin.email, displayName: admin.displayName, role: admin.role }, { headers: { "Set-Cookie": makeAdminCookie(session.token, session.expiresAt) } });
  } catch (error) { return jsonError(error); }
}
