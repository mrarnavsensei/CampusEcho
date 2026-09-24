import { spawnSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { executeLocalFixtureSql } from "./local-fixture-db.mjs";

const target = new URL(process.env.TEST_BASE_URL || "http://localhost:5173");
if (!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) || !["http:", "https:"].includes(target.protocol) || target.username || target.password || target.pathname !== "/" || target.search || target.hash) {
  throw new Error("Integration tests require a loopback TEST_BASE_URL with no credentials, path, query, or fragment. Remote targets are refused before fixtures are created.");
}
export const base = target.origin;
export const sqlValue = value => value === null ? "NULL" : typeof value === "number" ? String(value) : `'${String(value).replaceAll("'", "''")}'`;
export function db(statement) {
  if (process.env.TEST_DB_BACKEND === "sqlite") return executeLocalFixtureSql(statement);
  const result = spawnSync(process.execPath, [fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url)), "d1", "execute", "site-creator-d1", "--local", "--config", "wrangler.migrations.jsonc", "--command", statement, "--json"], { cwd: fileURLToPath(new URL("..", import.meta.url)), encoding: "utf8", env: { ...process.env, WRANGLER_SEND_METRICS: "false", CLOUDFLARE_CF_FETCH_ENABLED: "false" }, maxBuffer: 10 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error(`Fixture SQL failed: ${result.error?.message || result.stderr || result.stdout}`);
  const start = result.stdout.indexOf("[");
  return JSON.parse(result.stdout.slice(start));
}
export async function request(path, { token, method = "GET", body, headers = {} } = {}) {
  // These tests are loopback-only. Avoid retaining client sockets between checks;
  // this does not guarantee that the local preview proxy closes upstream sockets.
  const response = await fetch(`${base}${path}`, { method, headers: { Connection: "close", ...(token ? { Cookie: `echo_session=${token}` } : {}), ...(method !== "GET" ? { Origin: base } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30_000) });
  const text = await response.text();
  let payload;
  try { payload = JSON.parse(text); } catch { throw new Error(`${method} ${path} returned non-JSON ${response.status}: ${text.slice(0, 160)}`); }
  return { status: response.status, data: payload.data, error: payload.error, payload };
}
export function createFixture(prefix) {
  if (!/^[a-z][a-z0-9_]{0,20}$/.test(prefix)) throw new Error("Test fixture prefixes must contain only lowercase letters, digits, and underscores.");
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12), campusId = `${prefix}_campus_${suffix}`, otherCampusId = `${prefix}_other_${suffix}`, now = Date.now();
  const students = Array.from({ length: 4 }, (_, index) => ({ id: `${prefix}_u${index}_${suffix}`, token: randomBytes(32).toString("hex"), campusId: index === 3 ? otherCampusId : campusId, email: `${prefix}${index}${suffix}@example.invalid` }));
  const statements = [campusId, otherCampusId].map(id => `INSERT INTO campuses(id,name,slug,status,created_at,updated_at) VALUES(${sqlValue(id)},'Integration Test Campus',${sqlValue(id)},'active',${now},${now})`);
  for (const student of students) {
    statements.push(`INSERT INTO users(id,campus_id,email,email_verified_at,role,status,terms_accepted_at,created_at,updated_at) VALUES(${sqlValue(student.id)},${sqlValue(student.campusId)},${sqlValue(student.email)},${now},'student','active',${now},${now},${now})`);
    statements.push(`INSERT INTO profiles(user_id,handle,display_name,bio,is_private,anonymous_by_default,joined_at,updated_at) VALUES(${sqlValue(student.id)},${sqlValue(student.id)},'Integration student','',0,1,${now},${now})`);
    statements.push(`INSERT INTO sessions(id,user_id,token_hash,expires_at,created_at) VALUES(${sqlValue(randomUUID())},${sqlValue(student.id)},${sqlValue(createHash("sha256").update(student.token).digest("hex"))},${now + 3_600_000},${now})`);
    statements.push(`INSERT INTO student_verifications(user_id,status,review_note,updated_at) VALUES(${sqlValue(student.id)},'approved','Integration test',${now})`);
  }
  db(statements.join(";"));
  return { campusId, otherCampusId, students };
}
export function cleanupFixture(fixture) {
  const campuses = [fixture.campusId, fixture.otherCampusId].map(sqlValue).join(","), users = fixture.students.map(student => sqlValue(student.id)).join(",");
  db(`DELETE FROM message_receipts WHERE message_id IN (SELECT id FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE campus_id IN (${campuses})));
    DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE campus_id IN (${campuses}));
    DELETE FROM conversation_members WHERE conversation_id IN (SELECT id FROM conversations WHERE campus_id IN (${campuses}));
    DELETE FROM conversations WHERE campus_id IN (${campuses});
    DELETE FROM notifications WHERE user_id IN (${users});
    DELETE FROM reports WHERE campus_id IN (${campuses});
    DELETE FROM moderation_decisions WHERE campus_id IN (${campuses});
    DELETE FROM audit_logs WHERE campus_id IN (${campuses});
    DELETE FROM poll_votes WHERE poll_id IN (SELECT po.id FROM polls po JOIN posts p ON p.id=po.post_id WHERE p.campus_id IN (${campuses}));
    DELETE FROM poll_options WHERE poll_id IN (SELECT po.id FROM polls po JOIN posts p ON p.id=po.post_id WHERE p.campus_id IN (${campuses}));
    DELETE FROM polls WHERE post_id IN (SELECT id FROM posts WHERE campus_id IN (${campuses}));
    DELETE FROM post_likes WHERE post_id IN (SELECT id FROM posts WHERE campus_id IN (${campuses}));
    DELETE FROM bookmarks WHERE post_id IN (SELECT id FROM posts WHERE campus_id IN (${campuses}));
    DELETE FROM comments WHERE post_id IN (SELECT id FROM posts WHERE campus_id IN (${campuses}));
    DELETE FROM posts WHERE campus_id IN (${campuses});
    DELETE FROM registrations WHERE event_id IN (SELECT id FROM events WHERE campus_id IN (${campuses}));
    DELETE FROM events WHERE campus_id IN (${campuses});
    DELETE FROM blocks WHERE blocker_id IN (${users}) OR blocked_id IN (${users});
    DELETE FROM follows WHERE follower_id IN (${users}) OR followed_id IN (${users});
    DELETE FROM sessions WHERE user_id IN (${users});
    DELETE FROM student_verifications WHERE user_id IN (${users});
    DELETE FROM profiles WHERE user_id IN (${users});
    DELETE FROM users WHERE id IN (${users});
    DELETE FROM campuses WHERE id IN (${campuses});`);
}
