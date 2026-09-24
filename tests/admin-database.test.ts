import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

function database() {
  // Legacy 0001 uses SQLite's DQS compatibility, as enabled in the D1 runtime.
  // This fixture tests a fresh database; it does not certify legacy data upgrades.
  const db = new DatabaseSync(":memory:", { enableDoubleQuotedStringLiterals: true });
  db.exec("PRAGMA foreign_keys = ON");
  for (const file of ["0000_tough_carnage.sql", "0001_loose_stellaris.sql", "0004_admin_tables.sql", "0007_admin_hardening.sql"]) {
    db.exec(readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8"));
  }
  return db;
}

test("administrator migration prevents removing the final active Super Admin", () => {
  const db = database();
  try {
    db.exec("INSERT INTO admin_accounts (id,email,password_hash,display_name,role,status,created_at,updated_at) VALUES ('a','a@example.test','hash','A','super_admin','active',1,1), ('b','b@example.test','hash','B','super_admin','active',1,1)");
    db.exec("UPDATE admin_accounts SET status = 'inactive' WHERE id = 'a'");
    assert.throws(() => db.exec("UPDATE admin_accounts SET role = 'moderator' WHERE id = 'b'"), /last active Super Admin/);
    assert.throws(() => db.exec("UPDATE admin_accounts SET status = 'inactive' WHERE id = 'b'"), /last active Super Admin/);
    assert.equal(db.prepare("SELECT count(*) AS total FROM admin_accounts WHERE role = 'super_admin' AND status = 'active'").get()?.total, 1);
  } finally { db.close(); }
});

test("report assignments require existing reports and administrator accounts", () => {
  const db = database();
  try {
    assert.throws(() => db.exec("INSERT INTO report_reviews (report_id,assigned_admin_id,updated_at) VALUES ('missing','missing',1)"), /FOREIGN KEY/);
    assert.equal(db.prepare("SELECT count(*) AS total FROM report_reviews").get()?.total, 0);
  } finally { db.close(); }
});

test("moderation and audit schema preserves anonymized reports separately from administrator attribution", () => {
  const db = database();
  try {
    const reportColumns = db.prepare("PRAGMA table_info(report_reviews)").all().map(row => row.name);
    assert.deepEqual(reportColumns, ["report_id", "assigned_admin_id", "updated_at"]);
    const indexes = db.prepare("PRAGMA index_list(reports)").all().map(row => row.name);
    assert.ok(indexes.includes("reports_status_created_idx"));
    const auditIndexes = db.prepare("PRAGMA index_list(audit_logs)").all().map(row => row.name);
    assert.ok(auditIndexes.includes("audit_target_idx"));
  } finally { db.close(); }
});
