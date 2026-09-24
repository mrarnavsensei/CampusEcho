CREATE TABLE IF NOT EXISTS report_reviews (
  report_id TEXT PRIMARY KEY NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  assigned_admin_id TEXT REFERENCES admin_accounts(id),
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS reports_status_created_idx ON reports(status, created_at, id);
CREATE INDEX IF NOT EXISTS audit_created_idx ON audit_logs(created_at, id);
CREATE INDEX IF NOT EXISTS audit_target_idx ON audit_logs(target_type, target_id, created_at);
CREATE INDEX IF NOT EXISTS users_created_idx ON users(created_at, id);
UPDATE reports SET status = 'open' WHERE status = 'pending';
CREATE TRIGGER IF NOT EXISTS protect_last_super_admin_update
BEFORE UPDATE OF status, role ON admin_accounts
WHEN OLD.role = 'super_admin' AND OLD.status = 'active'
  AND (NEW.role <> 'super_admin' OR NEW.status <> 'active')
  AND (SELECT count(*) FROM admin_accounts WHERE role = 'super_admin' AND status = 'active') <= 1
BEGIN SELECT RAISE(ABORT, 'The last active Super Admin cannot be removed.'); END;
