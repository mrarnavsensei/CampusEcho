import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readDeployment, validateDeployment } from "./deployment-config.mjs";
import { verifyExport, verifyManifest } from "./backup-core.mjs";

try {
  const [command, file] = process.argv.slice(2);
  if (!file || !["export", "verify"].includes(command)) throw new Error("Usage: node scripts/backup.mjs export deployment.<environment>.local.jsonc | verify backups/<folder>/database.sql");
  if (command === "verify") {
    verifyManifest(readFileSync(file, "utf8"), JSON.parse(readFileSync(`${file}.manifest.json`, "utf8")));
    console.log("Backup checksum, isolated SQL restore, required tables, row counts, integrity and foreign keys passed. Remote recovery has not been tested.");
  } else {
    const { db, config } = validateDeployment(readDeployment(file), { file, artifacts: false });
    const folder = resolve("backups", `${config.vars.APP_ENV}-${Date.now()}-${randomUUID().slice(0, 8)}`);
    mkdirSync(folder, { recursive: true, mode: 0o700 });
    const output = join(folder, "database.sql");
    const result = spawnSync(process.execPath, [fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url)), "d1", "export", db.database_name, "--remote", "--config", resolve(file), "--output", output], { encoding: "utf8", env: { ...process.env, WRANGLER_SEND_METRICS: "false" }, timeout: 300_000, maxBuffer: 4 * 1024 * 1024 });
    if (result.error || result.status !== 0) throw new Error("Remote export failed. Check Cloudflare authentication, target access and provider status. Any partial export must not be used.");
    const verified = verifyExport(readFileSync(output, "utf8"));
    writeFileSync(`${output}.manifest.json`, JSON.stringify({ version: 1, createdAt: new Date().toISOString(), environment: config.vars.APP_ENV, databaseId: db.database_id, databaseName: db.database_name, ...verified }, null, 2), { flag: "wx", mode: 0o600 });
    console.log(`Verified backup saved to ${output}. It contains private data: encrypt it, restrict Windows ACLs, and copy it to approved separate storage.`);
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
