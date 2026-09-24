// Build an EMPTY production schema from reviewed migrations; never reads local D1 data.
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";

export function productionBaseline() {
  const db = new DatabaseSync(":memory:", { enableDoubleQuotedStringLiterals: true });
  try {
    db.exec("PRAGMA foreign_keys = ON");
    for (const name of ["0000_tough_carnage.sql", "0001_loose_stellaris.sql", "0004_admin_tables.sql", "0005_student_auth.sql", "0006_social.sql", "0007_admin_hardening.sql", "0008_chess.sql"]) {
      db.exec(readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8"));
    }
    const objects = db.prepare("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END, name").all();
    return "-- Fresh staging/production database only. No development users, colleges, or secrets.\n-- Derived from the reviewed schema through local migration 0008. Do not apply to an existing schema.\n\n" + objects.map(row => row.sql + ";").join("\n\n") + "\n\nINSERT INTO platform_settings(key,value,updated_at) VALUES\n('user_registration_enabled','false',0),\n('manual_verification_required','true',0),\n('voice_spaces_enabled','false',0);\n";
  } finally { db.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.stdout.write(productionBaseline());
