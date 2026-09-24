import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { productionBaseline } from "../scripts/schema-baseline.mjs";

test("fresh deployment schema contains no development identities and keeps registration closed", () => {
  const source = readFileSync(new URL("../drizzle-production/0000_baseline.sql", import.meta.url), "utf8");
  assert.equal(source, productionBaseline(), "Update fresh baseline when reviewed schema changes");
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("PRAGMA foreign_keys=ON");
    db.exec(source);
    for (const table of ["users", "campuses", "college_domains", "admin_accounts", "sessions"]) {
      assert.equal(db.prepare(`SELECT count(*) AS total FROM ${table}`).get()?.total, 0);
    }
    assert.equal(db.prepare("SELECT value FROM platform_settings WHERE key='user_registration_enabled'").get()?.value, "false");
    assert.equal(db.prepare("SELECT value FROM platform_settings WHERE key='manual_verification_required'").get()?.value, "true");
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    assert.ok(db.prepare("PRAGMA table_info(comments)").all().some(row => row.name === "alias"));
    assert.ok(db.prepare("PRAGMA table_info(conversation_members)").all().some(row => row.name === "last_read_at"));
  } finally { db.close(); }
});
