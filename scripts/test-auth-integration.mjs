import assert from "node:assert/strict";
import { createHash, pbkdf2Sync, randomBytes, randomUUID } from "node:crypto";
import { base, cleanupFixture, createFixture, db, sqlValue } from "./integration-helpers.mjs";

if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname)) throw new Error("Authentication fixtures require localhost TEST_BASE_URL.");
const testAddress = `fd00:${randomBytes(2).toString("hex")}:${randomBytes(2).toString("hex")}::1`;
const originalPassword = `Campus-original-${randomUUID()}`;
const nextPasswords = [`Campus-reset-a-${randomUUID()}`, `Campus-reset-b-${randomUUID()}`];
const unknownEmail = `missing-${randomUUID()}@example.invalid`;
const digest = value => createHash("sha256").update(value).digest("hex");
let checks = 0, fixture;
function check(condition, message) { assert.ok(condition, message); checks++; }
async function call(action, { token, method = "GET", body, headers = {} } = {}) {
  const response = await fetch(`${base}/api/auth/${action}`, { method, headers: { Connection: "close", "cf-connecting-ip": testAddress, ...(token ? { Cookie: `echo_session=${token}` } : {}), ...(method !== "GET" ? { Origin: base } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30_000) });
  const text = await response.text(); let payload;
  try { payload = JSON.parse(text); } catch { payload = { error: { message: text.slice(0, 100) } }; }
  return { status: response.status, data: payload.data, error: payload.error, cookie: response.headers.get("set-cookie") ?? "" };
}
async function deleteAccount(token, confirmation) {
  const response = await fetch(`${base}/api/account`, {
    method: "DELETE",
    headers: { Connection: "close", "cf-connecting-ip": testAddress, Origin: base, "Content-Type": "application/json", ...(token ? { Cookie: `echo_session=${token}` } : {}) },
    body: JSON.stringify({ confirmation }),
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json();
  return { status: response.status, data: payload.data, error: payload.error, cookie: response.headers.get("set-cookie") ?? "" };
}
function expect(response, status, message) { assert.equal(response.status, status, `${message}: ${response.error?.message ?? "unexpected response"}`); checks++; return response; }
const login = (student, password = originalPassword) => call("login", { method: "POST", body: { email: student.email, password } });
function cookieToken(response) { const token = /(?:^|[,;] *)echo_session=([a-f0-9]{64})/.exec(response.cookie)?.[1]; assert.ok(token, "Login must set a session cookie"); return token; }
function tokenRecord(student, purpose, expired = false) {
  const token = randomBytes(32).toString("hex"), now = Date.now();
  db(`INSERT INTO email_tokens(token_hash,user_id,purpose,expires_at,created_at) VALUES(${sqlValue(digest(token))},${sqlValue(student.id)},${sqlValue(purpose)},${now + (expired ? -1000 : 1_800_000)},${now})`);
  return token;
}
function extraSession(student, { expired = false, revoked = false } = {}) {
  const token = randomBytes(32).toString("hex"), now = Date.now();
  db(`INSERT INTO sessions(id,user_id,token_hash,expires_at,revoked_at,created_at) VALUES(${sqlValue(randomUUID())},${sqlValue(student.id)},${sqlValue(digest(token))},${now + (expired ? -1000 : 3_600_000)},${revoked ? now : "NULL"},${now})`);
  return token;
}
try {
  fixture = createFixture("qa_auth");
  const [active, unverified, restricted, extra] = fixture.students;
  const salt = randomBytes(16), passwordHash = `pbkdf2:sha256:600000:${salt.toString("hex")}:${pbkdf2Sync(originalPassword, salt, 600_000, 32, "sha256").toString("hex")}`;
  db(fixture.students.map(student => `INSERT INTO user_credentials(user_id,password_hash,updated_at) VALUES(${sqlValue(student.id)},${sqlValue(passwordHash)},${Date.now()})`).join(";") + `;
    UPDATE users SET email_verified_at=NULL WHERE id=${sqlValue(unverified.id)};
    UPDATE student_verifications SET status='pending' WHERE user_id=${sqlValue(unverified.id)};
    UPDATE users SET status='suspended' WHERE id=${sqlValue(restricted.id)};`);
  expect(await call("me"), 401, "Unauthenticated identity rejected");
  expect(await call("login", { method: "POST", body: { email: active.email, password: originalPassword }, headers: { Origin: "https://cross-origin.invalid" } }), 403, "Cross-origin login rejected");
  expect(await call("login", { method: "POST", body: { email: active.email, password: originalPassword }, headers: { "Content-Type": "text/plain" } }), 415, "Login requires JSON");
  expect(await call("login", { method: "POST", body: { email: active.email, password: originalPassword, unexpected: true } }), 422, "Unknown input fields rejected");
  expect(await call("login", { method: "POST", body: { email: active.email, password: "x".repeat(20_000) } }), 413, "Oversized auth body rejected");
  expect(await login(active, "incorrect password"), 401, "Incorrect password rejected");
  expect(await login({ email: unknownEmail }), 401, "Unknown account has generic credentials error");
  const signedIn = expect(await login(active), 200, "Valid password signs in");
  const currentToken = cookieToken(signedIn);
  check(signedIn.cookie.includes("HttpOnly") && signedIn.cookie.includes("SameSite=Strict") && signedIn.cookie.includes("Path=/"), "Session cookie protects browser access and cross-site use");
  check(expect(await call("me", { token: currentToken }), 200, "Login session authenticates").data.id === active.id, "Login session resolves the expected account");
  expect(await login(unverified), 403, "Unverified account cannot sign in");
  expect(await call("me", { token: unverified.token }), 403, "Unverified session cannot bypass email check");
  expect(await login(restricted), 401, "Suspended account cannot sign in");
  expect(await call("me", { token: restricted.token }), 403, "Suspended session cannot bypass status check");
  expect(await call("me", { token: extraSession(extra, { expired: true }) }), 401, "Expired session rejected");
  expect(await call("me", { token: extraSession(extra, { revoked: true }) }), 401, "Revoked session rejected");
  const sessionRows = expect(await call("sessions", { token: currentToken }), 200, "List own active sessions").data;
  check(sessionRows.length === 2 && sessionRows.filter(row => row.current).length === 1, "Exactly one session marked current");
  check(sessionRows.every(row => !Object.hasOwn(row, "tokenHash") && !Object.hasOwn(row, "token")), "Session list exposes no token or token hash");
  expect(await call("logout-others", { token: currentToken, method: "POST" }), 200, "Revoke other sessions");
  expect(await call("me", { token: active.token }), 401, "Other session revoked");
  expect(await call("me", { token: currentToken }), 200, "Current session preserved");
  const logout = expect(await call("logout", { token: currentToken, method: "POST" }), 200, "Current session logout");
  check(logout.cookie.includes("Max-Age=0"), "Logout expires browser cookie");
  expect(await call("me", { token: currentToken }), 401, "Logged-out token is revoked in database");

  const expiredVerify = tokenRecord(unverified, "verify", true);
  expect(await call("verify", { method: "POST", body: { token: expiredVerify } }), 400, "Expired verification token rejected");
  expect(await call("me", { token: unverified.token }), 403, "Expired token did not verify account");
  const verifyToken = tokenRecord(unverified, "verify");
  expect(await call("reset", { method: "POST", body: { token: verifyToken, password: nextPasswords[0] } }), 400, "Verification token cannot reset password");
  const verifyResults = await Promise.all([1, 2].map(() => call("verify", { method: "POST", body: { token: verifyToken } })));
  check(verifyResults.filter(response => response.status === 200).length === 1 && verifyResults.filter(response => response.status === 400).length === 1, "Concurrent verification consumes token exactly once");
  expect(await call("verify", { method: "POST", body: { token: verifyToken } }), 400, "Verification replay rejected");
  expect(await login(unverified), 200, "Verified student can now sign in");
  const verificationRows = db(`SELECT status FROM student_verifications WHERE user_id=${sqlValue(unverified.id)}`).flatMap(result => result.results ?? []);
  check(verificationRows[0]?.status === "domain_verified", "Mailbox verification records domain verification without claiming enrollment approval");

  const beforeReset = extraSession(active), beforeResetOther = extraSession(active);
  const expiredReset = tokenRecord(active, "reset", true);
  expect(await call("reset", { method: "POST", body: { token: expiredReset, password: nextPasswords[0] } }), 400, "Expired reset token rejected");
  expect(await call("me", { token: beforeReset }), 200, "Expired reset did not revoke sessions");
  const resetToken = tokenRecord(active, "reset");
  const resetResults = await Promise.all(nextPasswords.map(password => call("reset", { method: "POST", body: { token: resetToken, password } })));
  check(resetResults.filter(response => response.status === 200).length === 1 && resetResults.filter(response => response.status === 400).length === 1, "Concurrent reset changes password exactly once");
  const winningIndex = resetResults.findIndex(response => response.status === 200);
  expect(await call("reset", { method: "POST", body: { token: resetToken, password: originalPassword } }), 400, "Reset replay rejected");
  expect(await call("me", { token: beforeReset }), 401, "Reset revokes first old session");
  expect(await call("me", { token: beforeResetOther }), 401, "Reset revokes every old session");
  expect(await login(active), 401, "Old password no longer works");
  expect(await login(active, nextPasswords[1 - winningIndex]), 401, "Losing concurrent reset did not overwrite password");
  const afterReset = expect(await login(active, nextPasswords[winningIndex]), 200, "Winning reset password works");
  expect(await call("me", { token: cookieToken(afterReset) }), 200, "New login restores an authenticated session");
  expect(await deleteAccount(undefined, "DELETE"), 401, "Account deletion requires authentication");
  expect(await deleteAccount(extra.token, "delete"), 422, "Account deletion requires the exact confirmation");
  expect(await call("me", { token: extra.token }), 200, "Invalid deletion confirmation preserves the account");
  const deletion = expect(await deleteAccount(extra.token, "DELETE"), 200, "Confirmed account deletion request succeeds");
  check(deletion.data.deactivated === true && deletion.data.deletionStatus === "pending_retention_review", "Deletion response records pending retention review");
  check(deletion.cookie.includes("echo_session=") && deletion.cookie.includes("Max-Age=0"), "Deletion expires the student session cookie");
  check((await call("me", { token: extra.token })).status !== 200, "Deletion revokes existing student sessions");
  expect(await login(extra), 401, "Deactivated account cannot sign in again");
  const [deletedAccount] = db(`SELECT status,deleted_at FROM users WHERE id=${sqlValue(extra.id)}`).flatMap(result => result.results ?? []);
  const [activeSessions] = db(`SELECT count(*) AS total FROM sessions WHERE user_id=${sqlValue(extra.id)} AND revoked_at IS NULL`).flatMap(result => result.results ?? []);
  const [deletionAudits] = db(`SELECT count(*) AS total FROM audit_logs WHERE actor_id=${sqlValue(extra.id)} AND action='account.deletion_requested' AND target_id=${sqlValue(extra.id)}`).flatMap(result => result.results ?? []);
  check(deletedAccount?.status === "deactivated" && Number(deletedAccount?.deleted_at) > 0, "Deletion deactivates and timestamps the account");
  check(Number(activeSessions?.total) === 0 && Number(deletionAudits?.total) === 1, "Deletion revokes all sessions and creates one audit record");
  console.log(`Student auth integration: ${checks} assertions passed against ${base}. Registration and email delivery were not live-tested; no emails sent.`);
} finally {
  if (fixture) {
    const userIds = fixture.students.map(student => sqlValue(student.id)).join(",");
    const rateKeys = ["login", "register", "forgot", "resend", "verify", "reset"].map(action => digest(`auth:${action}:ip:${testAddress}`));
    rateKeys.push(...fixture.students.flatMap(student => [digest(`auth:login:email:${student.email}`), digest(`auth:email:${student.email}`)]));
    rateKeys.push(digest(`auth:login:email:${unknownEmail}`));
    db(`DELETE FROM email_tokens WHERE user_id IN (${userIds}); DELETE FROM user_credentials WHERE user_id IN (${userIds}); DELETE FROM security_rate_limits WHERE key IN (${rateKeys.map(sqlValue).join(",")});`);
    cleanupFixture(fixture);
    console.log("Removed temporary auth accounts, tokens, sessions and fixture rate-limit records.");
  }
}
