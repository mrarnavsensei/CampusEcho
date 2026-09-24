import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";

export const checksum = data => createHash("sha256").update(data).digest("hex");
// Only use trusted exports produced by your operator. SQL is executable input.
export function verifyExport(sql) {
  if (Buffer.byteLength(sql) > 256 * 1024 * 1024) throw new Error("Export exceeds the local verifier's 256 MiB limit; rehearse with a dedicated isolated database.");
  const statements = sql.replace(/'(?:[^']|'')*'|--[^\r\n]*|\/\*[\s\S]*?\*\//g, " ");
  if (/\b(?:ATTACH|DETACH|load_extension|writable_schema)\b/i.test(statements)) throw new Error("Export contains unsupported database-management statements.");
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(sql);
    if (db.prepare("PRAGMA integrity_check").get().integrity_check !== "ok") throw new Error("Database integrity check failed.");
    if (db.prepare("PRAGMA foreign_key_check").all().length) throw new Error("Export contains broken foreign keys.");
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => row.name);
    for (const required of ["users", "profiles", "sessions", "posts", "messages", "admin_accounts", "audit_logs", "chess_games", "platform_settings"]) {
      if (!tables.includes(required)) throw new Error(`Export is incomplete: missing ${required}.`);
    }
    const counts = Object.fromEntries(tables.map(table => [table, db.prepare(`SELECT count(*) AS total FROM "${table.replaceAll('"', '""')}"`).get().total]));
    return { sha256: checksum(sql), counts, integrity: "ok", foreignKeys: "ok" };
  } finally { db.close(); }
}

export function verifyManifest(sql, manifest) {
  if (manifest.version !== 1 || checksum(sql) !== manifest.sha256) throw new Error("Backup checksum/version does not match its manifest.");
  const restored = verifyExport(sql);
  if (JSON.stringify(restored.counts) !== JSON.stringify(manifest.counts)) throw new Error("Restored table counts do not match the backup manifest.");
  return restored;
}
