import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { adminAccounts } from "@/db/schema";
import { ApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { ADMIN_ROLES, hashPassword, requireAdminFromRequest } from "@/lib/admin-auth";
import { requireSameOrigin } from "@/lib/admin-api";
import { adminAuditStatement } from "@/lib/admin-audit";
const ROLES: string[] = Object.values(ADMIN_ROLES);
export async function GET(request: Request) { try { await requireAdminFromRequest(request, ["super_admin"]); return jsonOk(await getDb().select({ id: adminAccounts.id, email: adminAccounts.email, displayName: adminAccounts.displayName, role: adminAccounts.role, status: adminAccounts.status, lastLogin: adminAccounts.lastLoginAt, createdAt: adminAccounts.createdAt }).from(adminAccounts).orderBy(desc(adminAccounts.createdAt)).limit(500)); } catch (error) { return jsonError(error); } }
export async function POST(request: Request) {
  try {
    requireSameOrigin(request); const actor = await requireAdminFromRequest(request, ["super_admin"]);
    const body = await readJson<{ email?: string; password?: string; displayName?: string; role?: string }>(request);
    if (typeof body.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) || body.email.length > 254 || typeof body.displayName !== "string" || !body.displayName.trim() || body.displayName.length > 80 || typeof body.password !== "string" || body.password.length < 12 || body.password.length > 256 || !ROLES.includes(body.role || "")) throw new ApiError(400, "invalid_admin", "Valid email, name, role, and a password of 12–256 characters are required.");
    const db = getDb(), email = body.email.toLowerCase().trim(), id = crypto.randomUUID(), now = new Date();
    const [existing] = await db.select({ id: adminAccounts.id }).from(adminAccounts).where(eq(adminAccounts.email, email)).limit(1);
    if (existing) throw new ApiError(409, "email_exists", "An administrator with that email already exists.");
    await db.batch([db.insert(adminAccounts).values({ id, email, passwordHash: await hashPassword(body.password), displayName: body.displayName.trim(), role: body.role!, status: "active", createdAt: now, updatedAt: now }), adminAuditStatement({ adminId: actor.id, action: "admin.create", targetType: "admin_account", targetId: id, metadata: { role: body.role } })]);
    return jsonOk({ id }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
