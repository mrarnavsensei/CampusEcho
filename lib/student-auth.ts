import { env } from "cloudflare:workers";
import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { campuses, collegeDomains, platformSettings, profiles, sessions, users } from "@/db/schema";
import { studentVerifications } from "@/db/auth-schema";
import { ApiError } from "./api-error";
import { generateToken, hashToken } from "./password";

export type Student = { id: string; campusId: string; email: string; role: string };
export const STUDENT_COOKIE = "echo_session";
const SESSION_MS = 7 * 24 * 60 * 60_000;
type AuthEnvironment = { APP_ENV?: string; ENABLE_LOCAL_AUTH?: string };
export function readCookie(header: string, name: string): string | null {
  const raw = header.split(";").map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1);
  if (!raw) return null;
  try { return decodeURIComponent(raw); } catch { return null; }
}
export function studentCookie(token: string, request: Request, expires = SESSION_MS): string {
  const url = new URL(request.url);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  return `${STUDENT_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(expires / 1000)}${url.protocol === "https:" || !local ? "; Secure" : ""}`;
}
export async function studentToken(request?: Request): Promise<string | null> {
  return request ? readCookie(request.headers.get("cookie") ?? "", STUDENT_COOKIE) : (await cookies()).get(STUDENT_COOKIE)?.value ?? null;
}
export async function createStudentSession(userId: string, request: Request): Promise<string> {
  const token = generateToken(), now = new Date();
  await getDb().insert(sessions).values({ id: crypto.randomUUID(), userId, tokenHash: await hashToken(token), createdAt: now, expiresAt: new Date(now.getTime() + SESSION_MS) });
  return studentCookie(token, request);
}
export async function localAuthAvailable(request?: Request): Promise<boolean> {
  const config = env as AuthEnvironment;
  if (config.APP_ENV !== "development" || config.ENABLE_LOCAL_AUTH !== "true") return false;
  const host = request ? new URL(request.url).hostname : (await headers()).get("host")?.split(":")[0];
  return host === "localhost" || host === "127.0.0.1";
}
async function developmentStudent(request?: Request): Promise<string | null> {
  if (!(await localAuthAvailable(request))) return null;
  const identity = await getChatGPTUser();
  if (!identity || identity.userId !== "local_seedy" || identity.email !== "seedy@sites.test") return null;
  const db = getDb();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.id, identity.userId)).limit(1);
  if (existing) return existing.id;
  const [college] = await db.select({ id: campuses.id }).from(collegeDomains)
    .innerJoin(campuses, eq(campuses.id, collegeDomains.campusId))
    .where(and(eq(collegeDomains.domain, "sites.test"), eq(collegeDomains.verified, true), eq(campuses.status, "active"))).limit(1);
  if (!college) throw new ApiError(403, "college_not_approved", "No development campus is configured.");
  const [registration] = await db.select().from(platformSettings).where(eq(platformSettings.key, "user_registration_enabled")).limit(1);
  if (registration?.value === "false") throw new ApiError(403, "registration_disabled", "Registration is currently closed.");
  const now = new Date();
  await db.batch([
    db.insert(users).values({ id: identity.userId, campusId: college.id, email: identity.email, emailVerifiedAt: now, termsAcceptedAt: now, createdAt: now, updatedAt: now }).onConflictDoNothing(),
    db.insert(profiles).values({ userId: identity.userId, handle: "seedy_local", displayName: identity.fullName ?? "Local student", joinedAt: now, updatedAt: now }).onConflictDoNothing(),
  ]);
  return identity.userId;
}
export async function resolveStudent(request?: Request): Promise<Student | null> {
  const db = getDb(), token = await studentToken(request);
  let userId: string | null = null;
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    const [session] = await db.select({ userId: sessions.userId }).from(sessions).where(and(eq(sessions.tokenHash, await hashToken(token)), gt(sessions.expiresAt, new Date()), isNull(sessions.revokedAt))).limit(1);
    userId = session?.userId ?? null;
  }
  // No trust in arbitrary identity headers in staging/production.
  // An explicitly supplied session must never fall back to the local development identity.
  if (!userId && !token) userId = await developmentStudent(request);
  if (!userId) return null;
  const [user] = await db.select({ id: users.id, campusId: users.campusId, email: users.email, role: users.role, status: users.status, deletedAt: users.deletedAt, verified: users.emailVerifiedAt, collegeStatus: campuses.status, verificationStatus: studentVerifications.status })
    .from(users).innerJoin(campuses, eq(campuses.id, users.campusId)).leftJoin(studentVerifications, eq(studentVerifications.userId, users.id)).where(eq(users.id, userId)).limit(1);
  if (!user) return null;
  if (user.status !== "active" || user.deletedAt || user.collegeStatus !== "active" || user.verificationStatus === "rejected") throw new ApiError(403, "account_restricted", "Your account or college is restricted. Contact campus support.");
  if (!user.verified) throw new ApiError(403, "email_unverified", "Verify your college email before continuing.");
  const [policy] = await db.select().from(platformSettings).where(eq(platformSettings.key, "manual_verification_required")).limit(1);
  if (policy?.value === "true" && user.verificationStatus !== "approved") throw new ApiError(403, "verification_pending", "Your enrollment must be reviewed before you can participate.");
  return { id: user.id, campusId: user.campusId, email: user.email, role: user.role };
}
