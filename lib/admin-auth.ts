import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import { adminAccounts, adminSessions } from "@/db/schema";
import { ApiError } from "@/lib/api";
import { generateToken, hashToken } from "@/lib/password";
export { hashPassword, verifyPassword } from "@/lib/password";

export type AdminAccount = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
};

const COOKIE_NAME = "admin_token";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days


export async function createAdminSession(adminId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const id = crypto.randomUUID();
  await getDb().insert(adminSessions).values({
    id,
    adminId,
    tokenHash,
    expiresAt,
    createdAt: new Date(),
  });
  return { token, expiresAt };
}

export async function revokeAdminSession(token: string): Promise<void> {
  const tokenHash = await hashToken(token);
  await getDb()
    .update(adminSessions)
    .set({ revokedAt: new Date() })
    .where(eq(adminSessions.tokenHash, tokenHash));
}

async function resolveToken(token: string): Promise<AdminAccount | null> {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const tokenHash = await hashToken(token);
  const db = getDb();
  const now = new Date();
  const [session] = await db
    .select({ adminId: adminSessions.adminId })
    .from(adminSessions)
    .where(
      and(
        eq(adminSessions.tokenHash, tokenHash),
        gt(adminSessions.expiresAt, now),
        isNull(adminSessions.revokedAt)
      )
    )
    .limit(1);
  if (!session) return null;
  const [admin] = await db
    .select({ id: adminAccounts.id, email: adminAccounts.email, displayName: adminAccounts.displayName, role: adminAccounts.role, status: adminAccounts.status })
    .from(adminAccounts)
    .where(and(eq(adminAccounts.id, session.adminId), eq(adminAccounts.status, "active")))
    .limit(1);
  return admin ?? null;
}

// For server components (reads from next/headers cookies)
export async function getAdminFromCookies(): Promise<AdminAccount | null> {
  try {
    const store = await cookies();
    const token = store.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return resolveToken(token);
  } catch {
    return null;
  }
}

// For API route handlers (reads from Request cookie header)
export async function getAdminFromRequest(request: Request): Promise<AdminAccount | null> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const token = parseCookieHeader(cookieHeader)[COOKIE_NAME];
  if (!token) return null;
  return resolveToken(token);
}

export async function requireAdminFromRequest(
  request: Request,
  allowedRoles?: string[]
): Promise<AdminAccount> {
  const admin = await getAdminFromRequest(request);
  if (!admin) throw new ApiError(401, "admin_unauthenticated", "Admin sign-in required.");
  if (allowedRoles && !allowedRoles.includes(admin.role)) {
    throw new ApiError(403, "admin_forbidden", "You do not have permission to perform this action.");
  }
  return admin;
}

export function makeAdminCookie(token: string, expiresAt: Date): string {
  const maxAge = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

export function clearAdminCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

function parseCookieHeader(header: string): Record<string, string> {
  return Object.fromEntries(
    header.split(";").map((pair) => {
      const idx = pair.indexOf("=");
      if (idx === -1) return ["", ""];
      return [pair.slice(0, idx).trim(), pair.slice(idx + 1).trim()];
    }).filter(([k]) => k)
  );
}


export const ADMIN_ROLES = {
  SUPER_ADMIN: "super_admin",
  MODERATOR: "moderator",
  EVENT_MANAGER: "event_manager",
  SUPPORT_ADMIN: "support_admin",
} as const;

export const ROLE_HIERARCHY: Record<string, string[]> = {
  super_admin: ["super_admin", "moderator", "event_manager", "support_admin"],
  moderator: ["moderator"],
  event_manager: ["event_manager"],
  support_admin: ["support_admin"],
};

export function hasPermission(admin: AdminAccount, requiredRole: string): boolean {
  return ROLE_HIERARCHY[admin.role]?.includes(requiredRole) ?? false;
}
