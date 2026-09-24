// Optional low-memory fixture setup, never used by application/runtime queries.
import { readdirSync, realpathSync } from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

export function executeLocalFixtureSql(statement) {
  const target = new URL(process.env.TEST_BASE_URL || process.env.ECHO_TEST_BASE_URL || "http://localhost:5173");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) || !["http:", "https:"].includes(target.protocol) || target.username || target.password || target.pathname !== "/" || target.search || target.hash) {
    throw new Error("Direct fixture setup is restricted to a loopback test server.");
  }
  const root = realpathSync(fileURLToPath(new URL("..", import.meta.url)));
  const directory = realpathSync(resolve(root, ".wrangler/state/v3/d1/miniflare-D1DatabaseObject"));
  function assertInsideWorkspace(path) {
    const child = relative(root, path);
    if (!child || child.startsWith("..") || isAbsolute(child)) throw new Error("Fixture database must stay inside this workspace.");
  }
  assertInsideWorkspace(directory);
  // Do not guess when multiple bindings are present, create a database, or open metadata.sqlite.
  const candidates = readdirSync(directory).filter(name => /^[a-f0-9]{64}\.sqlite$/.test(name));
  if (candidates.length !== 1) throw new Error("Expected exactly one existing local D1 database. Use the default Wrangler fixture backend otherwise.");
  const filename = realpathSync(resolve(directory, candidates[0]));
  assertInsideWorkspace(filename);
  const database = new DatabaseSync(filename);
  try {
    database.exec("PRAGMA busy_timeout=10000; PRAGMA foreign_keys=ON;");
    const names = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users','campuses','sessions','chess_games','admin_accounts')").all();
    if (names.length !== 5) throw new Error("Local database does not match the migrated CampusCrate schema.");
    if (/^\s*SELECT\b/i.test(statement)) return [{ results: database.prepare(statement).all(), success: true }];
    // Seed/cleanup atomically, including triggers; do not split SQL on semicolons.
    database.exec("BEGIN IMMEDIATE");
    try { database.exec(statement); database.exec("COMMIT"); }
    catch (error) { database.exec("ROLLBACK"); throw error; }
    return [{ results: [], success: true }];
  } finally { database.close(); }
}
