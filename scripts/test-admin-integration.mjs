// Local-only integration test. Creates isolated fixtures and removes them in finally.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes, createHash, pbkdf2Sync } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { executeLocalFixtureSql } from './local-fixture-db.mjs';

const base = process.env.TEST_BASE_URL || process.env.ECHO_TEST_BASE_URL || 'http://localhost:5173';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Tests are restricted to a local server.');
const testAddress = `fd00:${randomBytes(2).toString('hex')}:${randomBytes(2).toString('hex')}::1`;
const prefix = `adminqa_${randomBytes(6).toString('hex')}`, campus = `${prefix}_campus`, student = `${prefix}_student`, post = `${prefix}_post`, report = `${prefix}_report`, messageReport = `${prefix}_message_report`;
const trigger = `${prefix}_audit_failure`, now = Date.now(), password = randomBytes(20).toString('hex');
const salt = randomBytes(16), passwordHash = `pbkdf2:sha256:600000:${salt.toString('hex')}:${pbkdf2Sync(password, salt, 600000, 32, 'sha256').toString('hex')}`;
const sha = value => createHash('sha256').update(value).digest('hex');
const sql = value => `'${String(value).replaceAll("'", "''")}'`;
const wrangler = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
function execute(statement) {
  if (process.env.TEST_DB_BACKEND === 'sqlite') return executeLocalFixtureSql(statement);
  try { return execFileSync(process.execPath, [wrangler, 'd1', 'execute', 'site-creator-d1', '--local', '--config', 'wrangler.migrations.jsonc', '--command', statement, '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch { throw new Error('Local D1 fixture command failed.'); }
}
const accounts = Object.fromEntries(['super_admin', 'moderator', 'support_admin', 'event_manager'].map(role => [role, { id: `${prefix}_${role}`, email: `${prefix}.${role}@example.test`, token: randomBytes(32).toString('hex') }]));
const cookies = Object.fromEntries(Object.entries(accounts).map(([role, account]) => [role, `admin_token=${account.token}`]));
const studentToken = randomBytes(32).toString('hex');
async function request(path, { role = 'super_admin', method = 'GET', body, origin = base, cookie } = {}) {
  const response = await fetch(`${base}${path}`, { method, headers: { Connection: "close", 'cf-connecting-ip': testAddress, ...(role ? { Cookie: cookies[role] } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(method !== 'GET' ? { Origin: origin, 'Content-Type': 'application/json' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const raw = await response.text();
  let payload;
  try { payload = JSON.parse(raw); } catch { payload = { error: { message: raw } }; }
  return { status: response.status, ...payload };
}
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; }

try {
  execute(`INSERT INTO campuses(id,name,slug,status,created_at,updated_at) VALUES (${sql(campus)},'Admin QA',${sql(prefix)},'active',${now},${now});
    INSERT INTO users(id,campus_id,email,email_verified_at,role,status,created_at,updated_at) VALUES (${sql(student)},${sql(campus)},${sql(`${prefix}@example.test`)},${now},'student','active',${now},${now});
    INSERT INTO profiles(user_id,handle,display_name,joined_at,updated_at) VALUES (${sql(student)},${sql(prefix)},'Private fixture student',${now},${now});
    INSERT INTO student_verifications(user_id,status,review_note,updated_at) VALUES (${sql(student)},'approved','Fixture',${now});
    INSERT INTO sessions(id,user_id,token_hash,expires_at,created_at) VALUES (${sql(`${prefix}_session`)},${sql(student)},${sql(sha(studentToken))},${now + 3600000},${now});
    INSERT INTO posts(id,campus_id,author_id,alias,visibility,body,kind,status,moderation_status,created_at,updated_at) VALUES (${sql(post)},${sql(campus)},${sql(student)},'Anonymous fixture','anonymous','Integration test content','text','published','approved',${now},${now});
    INSERT INTO reports(id,campus_id,reporter_id,target_type,target_id,reason,details,status,created_at,updated_at) VALUES (${sql(report)},${sql(campus)},${sql(student)},'post',${sql(post)},'Fixture review','Integration fixture','open',${now},${now}), (${sql(messageReport)},${sql(campus)},${sql(student)},'message',${sql(`${prefix}_message`)},'Private message report','Reported privately','open',${now},${now});
    ${Object.values(accounts).map(a => `INSERT INTO admin_accounts(id,email,password_hash,display_name,role,status,created_at,updated_at) VALUES (${sql(a.id)},${sql(a.email)},${sql(passwordHash)},'QA administrator',${sql(Object.keys(accounts).find(role => accounts[role] === a))},'active',${now},${now}); INSERT INTO admin_sessions(id,admin_id,token_hash,expires_at,created_at) VALUES (${sql(`${a.id}_session`)},${sql(a.id)},${sql(sha(a.token))},${now + 3600000},${now});`).join('\n')}`);

  check((await request('/api/admin/users', { role: null })).status === 401, 'Anonymous admin API access must be denied');
  const pageResponse = await fetch(`${base}/admin/users`, { redirect: 'manual' });
  check([302, 303, 307, 308].includes(pageResponse.status) && pageResponse.headers.get('location')?.includes('/admin/login'), 'Admin page must redirect on the server');
  check((await request('/api/admin/users', { role: 'event_manager' })).status === 403, 'Event manager cannot read users');
  check((await request('/api/admin/administrators', { role: 'moderator' })).status === 403, 'Moderator cannot manage administrators');
  check((await request('/api/admin/users?pageSize=1000')).status === 400, 'Pagination must be bounded');
  const userPage = await request(`/api/admin/users?q=${prefix}&pageSize=1`);
  check(userPage.status === 200 && userPage.data.items.length === 1 && userPage.data.total === 1, 'User filtering and pagination must use the database');
  const dashboard = await request('/api/admin/dashboard/stats', { role: 'event_manager' });
  check(dashboard.status === 200 && dashboard.data.recentUsers.length === 0 && dashboard.data.recentReports.length === 0, 'Event dashboard must not expose user or report details');
  const detail = await request(`/api/admin/moderation/${report}`);
  const detailJson = JSON.stringify(detail);
  check(detail.status === 200 && detail.data.content.body === 'Integration test content' && !detailJson.includes(student) && !detailJson.includes('authorId') && !detailJson.includes('reporterId'), 'Report detail must preserve anonymous identity');
  const privateDetail = await request(`/api/admin/moderation/${messageReport}`);
  check(privateDetail.status === 200 && privateDetail.data.content === null, 'Private message content must not be exposed');
  check((await request(`/api/admin/moderation/${report}`, { method: 'PATCH', role: 'support_admin', body: { action: 'remove', note: 'Fixture reason' } })).status === 403, 'Support cannot remove content');
  check((await request(`/api/admin/moderation/${report}`, { method: 'PATCH', origin: 'https://evil.example', body: { action: 'remove', note: 'Fixture reason' } })).status === 403, 'Cross-origin actions must fail');
  check((await request(`/api/admin/moderation/${report}`, { method: 'PATCH', body: { action: 'remove' } })).status === 400, 'Content actions require a review reason');
  execute(`CREATE TRIGGER ${trigger} BEFORE INSERT ON audit_logs WHEN NEW.target_id = ${sql(report)} AND NEW.action = 'report.remove' BEGIN SELECT RAISE(ABORT, 'Fixture audit unavailable'); END;`);
  check((await request(`/api/admin/moderation/${report}`, { method: 'PATCH', body: { action: 'remove', note: 'Test failed audit' } })).status === 500, 'Audit failure must fail the administrative action');
  check((await request(`/api/admin/moderation/${report}`)).data.content.status === 'published', 'Failed audit must roll back content removal');
  execute(`DROP TRIGGER ${trigger};`);
  check((await request(`/api/admin/moderation/${report}`, { method: 'PATCH', role: 'moderator', body: { action: 'remove', note: 'Fixture moderation decision' } })).status === 200, 'Moderator can remove reported content');
  const removed = await request(`/api/admin/moderation/${report}`);
  check(removed.data.content.status === 'removed' && removed.data.status === 'resolved' && removed.data.history.some(row => row.action === 'report.remove'), 'Removal must persist and produce an audit record');
  const feed = await request('/api/posts', { role: null, cookie: `echo_session=${studentToken}` });
  check(feed.status === 200 && !JSON.stringify(feed.data).includes(post), 'Moderated content must disappear from student feed');
  check((await request(`/api/admin/moderation/${report}`, { method: 'PATCH', body: { action: 'restore', note: 'Fixture appeal accepted' } })).status === 200, 'Moderator can restore reported content');
  check((await request(`/api/admin/moderation/${report}`, { method: 'PATCH', body: { action: 'assign', note: 'Assign fixture review', assignedAdminId: accounts.moderator.id } })).status === 200, 'Report assignment must persist');
  check((await request(`/api/admin/users/${student}`, { method: 'PATCH', role: 'support_admin', body: { action: 'reject_verification', reason: 'Fixture rejection' } })).status === 200, 'Support can reject student verification');
  check((await request('/api/posts', { role: null, cookie: `echo_session=${studentToken}` })).status === 403, 'Rejected student cannot access feed');
  check((await request(`/api/admin/users/${student}`, { method: 'PATCH', role: 'support_admin', body: { action: 'verify', reason: 'Fixture enrollment approved' } })).status === 200, 'Support can approve verified email student');
  check((await request(`/api/admin/users/${student}`, { method: 'PATCH', role: 'moderator', body: { action: 'suspend', reason: 'Fixture suspension' } })).status === 200, 'Moderator can suspend a student');
  check((await request('/api/posts', { role: null, cookie: `echo_session=${studentToken}` })).status !== 200, 'Suspension must revoke student sessions');
  check((await request(`/api/admin/administrators/${accounts.super_admin.id}`, { method: 'PATCH', body: { role: 'moderator' } })).status === 400, 'Super Admin cannot demote own access');
  const login = await request('/api/admin/auth/login', { role: null, method: 'POST', body: { email: accounts.super_admin.email, password } });
  check(login.status === 200 && login.data.id === accounts.super_admin.id, 'Admin password login must work against stored hash');
  const audit = await request(`/api/admin/audit-logs?q=${report}`);
  check(audit.status === 200 && audit.data.items.some(row => row.action === 'report.remove'), 'Audit records are queryable');
  console.log(`PASS: ${checks} admin integration assertions; authorization, privacy, CSRF, moderation, audit rollback, verification, sessions, pagination, login.`);
} finally {
  execute(`DROP TRIGGER IF EXISTS ${trigger};
    DELETE FROM report_reviews WHERE report_id IN (${sql(report)},${sql(messageReport)});
    DELETE FROM reports WHERE campus_id = ${sql(campus)};
    DELETE FROM moderation_decisions WHERE campus_id = ${sql(campus)};
    DELETE FROM audit_logs WHERE campus_id = ${sql(campus)} OR metadata LIKE ${sql(`%${prefix}%`)} OR target_id LIKE ${sql(`${prefix}%`)};
    DELETE FROM posts WHERE campus_id = ${sql(campus)};
    DELETE FROM users WHERE campus_id = ${sql(campus)};
    DELETE FROM campuses WHERE id = ${sql(campus)};
    DELETE FROM admin_sessions WHERE admin_id LIKE ${sql(`${prefix}%`)};
    DELETE FROM admin_accounts WHERE id LIKE ${sql(`${prefix}%`)};
    DELETE FROM security_rate_limits WHERE key IN (${sql(sha(`admin-login:${testAddress}`))},${sql(sha(`admin-login-email:${accounts.super_admin.email}`))});`);
  console.log('Removed only the isolated admin QA fixtures and failure-injection trigger.');
}
