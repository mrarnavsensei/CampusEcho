import { env } from "cloudflare:workers";
import { and, eq, gt, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { campuses, collegeDomains, profiles, sessions, users } from "@/db/schema";
import { emailTokens, studentVerifications, userCredentials } from "@/db/auth-schema";
import { ApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { createStudentSession, localAuthAvailable, resolveStudent, studentCookie, studentToken } from "@/lib/student-auth";
import { consumeRateLimit, enforceSameOrigin, requestAddress, requireFeature } from "@/lib/security";
import { generateToken, hashPassword, hashToken, verifyPassword } from "@/lib/password";
import { emailConfigured, sendAccountEmail } from "@/lib/email";
import { readPolicyConfiguration, type PolicyEnvironment } from "@/lib/policy-config";

type Context = { params: Promise<{ action: string }> };
const emailSchema = z.string().trim().email().max(254).transform(value => value.toLowerCase());
const passwordSchema = z.string().min(12, "Use a password of at least 12 characters.").max(256);
const parse = <T>(schema: z.ZodType<T>, body: unknown): T => {
  const result = schema.safeParse(body);
  if (!result.success) throw new ApiError(422, "invalid_input", result.error.issues[0]?.message ?? "Check the supplied values.");
  return result.data;
};
async function issueEmail(userId: string, email: string, purpose: "verify" | "reset") {
  const token = generateToken(), now = new Date();
  await getDb().insert(emailTokens).values({ tokenHash: await hashToken(token), userId, purpose, expiresAt: new Date(now.getTime() + 30 * 60_000), createdAt: now });
  try { await sendAccountEmail(email, token, purpose); }
  catch (error) { await getDb().delete(emailTokens).where(eq(emailTokens.tokenHash, await hashToken(token))); throw error; }
}
export async function GET(request: Request, { params }: Context) {
  try {
    const { action } = await params;
    if (action === "config") {
      const policy = readPolicyConfiguration(env as PolicyEnvironment);
      return jsonOk({ emailAvailable: emailConfigured(), localSignIn: await localAuthAvailable(request), minimumAge: policy.minimumAge, policyApproved: policy.approved });
    }
    if (action === "colleges") {
      const rows = await getDb().select({ id: campuses.id, name: campuses.name, domain: collegeDomains.domain }).from(collegeDomains).innerJoin(campuses, eq(campuses.id, collegeDomains.campusId)).where(and(eq(campuses.status, "active"), eq(collegeDomains.verified, true)));
      return jsonOk(rows.filter(row => row.domain !== "sites.test"));
    }
    const student = await resolveStudent(request);
    if (!student) throw new ApiError(401, "unauthenticated", "Sign in to continue.");
    if (action === "me") return jsonOk(student);
    if (action === "sessions") {
      const token = await studentToken(request), current = token ? await hashToken(token) : null;
      const rows = await getDb().select({ id: sessions.id, tokenHash: sessions.tokenHash, createdAt: sessions.createdAt, expiresAt: sessions.expiresAt }).from(sessions).where(and(eq(sessions.userId, student.id), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date()))).limit(100);
      return jsonOk(rows.map(({ tokenHash, ...row }) => ({ ...row, current: tokenHash === current })));
    }
    throw new ApiError(404, "not_found", "Endpoint not found.");
  } catch (error) { return jsonError(error); }
}
export async function POST(request: Request, { params }: Context) {
  try {
    enforceSameOrigin(request);
    const { action } = await params;
    const db = getDb();
    if (action === "logout") {
      const token = await studentToken(request);
      if (token) await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenHash, await hashToken(token)));
      const response = jsonOk({ signedOut: true });
      response.headers.append("Set-Cookie", studentCookie("", request, 0));
      response.headers.append("Set-Cookie", "__sites_local_auth=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
      return response;
    }
    if (action === "logout-others") {
      const student = await resolveStudent(request), token = await studentToken(request);
      if (!student) throw new ApiError(401, "unauthenticated", "Sign in to continue.");
      await db.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, student.id), token ? ne(sessions.tokenHash, await hashToken(token)) : undefined));
      return jsonOk({ revoked: true });
    }
    if (!["login", "register", "forgot", "resend", "verify", "reset"].includes(action)) throw new ApiError(404, "not_found", "Endpoint not found.");
    await consumeRateLimit(`auth:${action}:ip:${requestAddress(request)}`, 30, 15 * 60_000);
    const body = await readJson<unknown>(request);
    if (action === "register") {
      await requireFeature("user_registration_enabled");
      if (!emailConfigured()) throw new ApiError(503, "email_unavailable", "Student registration opens when college verification email is configured.");
      const input = parse(z.object({ email: emailSchema, password: passwordSchema, displayName: z.string().trim().min(2).max(60), termsAccepted: z.literal(true), ageConfirmed: z.literal(true) }).strict(), body);
      await consumeRateLimit(`auth:email:${input.email}`, 5, 60 * 60_000);
      const domain = input.email.split("@")[1];
      const [college] = await db.select({ id: campuses.id }).from(collegeDomains).innerJoin(campuses, eq(campuses.id, collegeDomains.campusId)).where(and(eq(collegeDomains.domain, domain), eq(collegeDomains.verified, true), eq(campuses.status, "active"))).limit(1);
      if (!college || domain === "sites.test") throw new ApiError(422, "college_not_approved", "Use an email address from an approved college.");
      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
      if (existing) return jsonOk({ message: "If this address is eligible, check your email or use sign in / resend verification." });
      const id = crypto.randomUUID(), now = new Date();
      await db.batch([
        db.insert(users).values({ id, campusId: college.id, email: input.email, status: "active", termsAcceptedAt: now, createdAt: now, updatedAt: now }),
        db.insert(profiles).values({ userId: id, handle: `student_${id.replaceAll("-", "").slice(0, 12)}`, displayName: input.displayName, joinedAt: now, updatedAt: now }),
        db.insert(userCredentials).values({ userId: id, passwordHash: await hashPassword(input.password), updatedAt: now }),
        db.insert(studentVerifications).values({ userId: id, status: "pending", updatedAt: now }),
      ]);
      await issueEmail(id, input.email, "verify");
      return jsonOk({ message: "Check your college inbox to verify your email, then sign in." }, { status: 201 });
    }
    if (action === "login") {
      const input = parse(z.object({ email: emailSchema, password: z.string().min(1).max(256) }).strict(), body);
      await consumeRateLimit(`auth:login:email:${input.email}`, 10, 15 * 60_000);
      const [account] = await db.select({ id: users.id, passwordHash: userCredentials.passwordHash, status: users.status, deletedAt: users.deletedAt, verified: users.emailVerifiedAt, campusStatus: campuses.status }).from(users).innerJoin(userCredentials, eq(userCredentials.userId, users.id)).innerJoin(campuses, eq(campuses.id, users.campusId)).where(eq(users.email, input.email)).limit(1);
      // Equal work for unknown accounts limits useful timing differences.
      const dummy = "pbkdf2:sha256:600000:00000000000000000000000000000000:" + "0".repeat(64);
      const matches = await verifyPassword(input.password, account?.passwordHash ?? dummy);
      if (!account || !matches || account.deletedAt || account.status !== "active" || account.campusStatus !== "active") throw new ApiError(401, "invalid_credentials", "Invalid email or password.");
      if (!account.verified) throw new ApiError(403, "email_unverified", "Verify your college email before signing in. You can request another verification email.");
      return jsonOk({ signedIn: true }, { headers: { "Set-Cookie": await createStudentSession(account.id, request) } });
    }
    if (action === "forgot" || action === "resend") {
      const { email } = parse(z.object({ email: emailSchema }).strict(), body);
      if (!emailConfigured()) throw new ApiError(503, "email_unavailable", "Email delivery is not configured. Contact platform support.");
      await consumeRateLimit(`auth:email:${email}`, 5, 60 * 60_000);
      const [account] = await db.select().from(users).where(and(eq(users.email, email), eq(users.status, "active"), isNull(users.deletedAt))).limit(1);
      if (account && (action === "forgot" || !account.emailVerifiedAt)) await issueEmail(account.id, email, action === "forgot" ? "reset" : "verify");
      return jsonOk({ message: "If the address is eligible, an email will arrive shortly." });
    }
    const input = parse(z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), ...(action === "reset" ? { password: passwordSchema } : {}) }).strict(), body);
    const digest = await hashToken(input.token), now = Date.now(), purpose = action === "verify" ? "verify" : "reset";
    if (!env.DB) throw new ApiError(503, "unavailable", "Database unavailable.");
    const validToken = "SELECT user_id FROM email_tokens WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > ?";
    const statements = action === "verify" ? [
      env.DB.prepare(`UPDATE users SET email_verified_at=?,updated_at=? WHERE id IN (${validToken}) AND deleted_at IS NULL`).bind(now, now, digest, purpose, now),
      env.DB.prepare(`UPDATE student_verifications SET status='domain_verified',updated_at=? WHERE user_id IN (${validToken}) AND status='pending'`).bind(now, digest, purpose, now),
    ] : [
      env.DB.prepare(`UPDATE user_credentials SET password_hash=?,updated_at=? WHERE user_id IN (${validToken})`).bind(await hashPassword((input as { password: string }).password), now, digest, purpose, now),
      env.DB.prepare(`UPDATE sessions SET revoked_at=? WHERE user_id IN (${validToken})`).bind(now, digest, purpose, now),
    ];
    statements.push(env.DB.prepare("UPDATE email_tokens SET used_at=? WHERE token_hash=? AND purpose=? AND used_at IS NULL AND expires_at > ? RETURNING user_id").bind(now, digest, purpose, now));
    const result = await env.DB.batch(statements);
    if (!result[result.length - 1].results.length) throw new ApiError(400, "token_expired", "This link is invalid or expired. Request a new email.");
    return jsonOk({ message: action === "verify" ? "Email verified. You can now sign in." : "Password changed. Sign in with your new password." });
  } catch (error) { return jsonError(error); }
}
