import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import ts from "typescript";

export const REQUIRED_POLICY_VARIABLES = [
  "POLICY_OPERATOR_NAME", "POLICY_SUPPORT_CONTACT", "POLICY_PRIVACY_CONTACT", "POLICY_GRIEVANCE_CONTACT",
  "POLICY_URGENT_SAFETY_CONTACT", "POLICY_APPEAL_CONTACT", "POLICY_SUPPORT_RESPONSE_TARGET", "POLICY_EFFECTIVE_DATE",
  "POLICY_VERSION", "POLICY_LAUNCH_REGIONS", "POLICY_ENROLLMENT_CRITERIA", "POLICY_PROVIDER_SUMMARY", "POLICY_RETENTION_SUMMARY",
];

const unresolved = value => !String(value ?? "").trim() || /TO COMPLETE|REPLACE_WITH|example\.|\.invalid|\.test$/i.test(String(value));

export function readDeployment(file) {
  const parsed = ts.parseConfigFileTextToJson(file, readFileSync(file, "utf8"));
  if (parsed.error) throw new Error("Deployment configuration is not valid JSONC.");
  return parsed.config;
}

export function validateDeployment(config, { file = "deployment.staging.local.jsonc", artifacts = true } = {}) {
  const fail = message => { throw new Error(message); };
  if (!/^[a-z][a-z0-9-]{2,62}$/.test(config.name ?? "")) fail("Set a valid Worker name.");
  const databases = config.d1_databases ?? [];
  const db = databases.find(item => item.binding === "DB");
  if (databases.length !== 1 || !db || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(db.database_id ?? "") || db.database_id.startsWith("00000000-")) fail("Set exactly one real D1 database UUID with binding DB.");
  if (!/^[a-zA-Z][a-zA-Z0-9_-]{2,62}$/.test(db.database_name ?? "")) fail("Set a valid D1 database name.");
  if (!["staging", "production"].includes(config.vars?.APP_ENV) || config.vars?.ENABLE_LOCAL_AUTH !== "false") fail("Public deployments require staging/production and ENABLE_LOCAL_AUTH=false.");
  const url = new URL(config.vars.APP_URL);
  if (url.protocol !== "https:" || url.username || url.password || url.port || /localhost|example\.|replace|\.invalid$|\.test$/i.test(url.hostname) || !url.hostname.includes(".") || url.pathname !== "/" || url.search || url.hash) fail("Set APP_URL to the real HTTPS app origin without credentials, port, or path.");
  if (!/^(?:[^<>\r\n]+ <[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+>|[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+)$/.test(config.vars.EMAIL_FROM ?? "") || /replace|example\.|\.invalid|\.test/i.test(config.vars.EMAIL_FROM)) fail("Set EMAIL_FROM to the verified sender.");
  const minimumAge = Number(config.vars.POLICY_MINIMUM_AGE);
  if (!Number.isInteger(minimumAge) || minimumAge < 13 || minimumAge > 120) fail("Set POLICY_MINIMUM_AGE to an integer from 13 through 120.");
  if (!['draft', 'approved'].includes(config.vars.POLICY_STATUS)) fail("Set POLICY_STATUS to draft or approved.");
  const pendingPolicy = REQUIRED_POLICY_VARIABLES.filter(key => unresolved(config.vars[key]));
  if (config.vars.APP_ENV === "production" && (config.vars.POLICY_STATUS !== "approved" || pendingPolicy.length)) {
    fail(`Production policy configuration is not approved. Pending: ${[...(config.vars.POLICY_STATUS === "approved" ? [] : ["POLICY_STATUS"]), ...pendingPolicy].join(", ")}.`);
  }
  if (Object.keys(config.vars).some(key => /SECRET|PASSWORD|API_KEY|TOKEN/i.test(key))) fail("Store credentials with Wrangler secrets, not plain vars.");
  if (config.main !== "dist/server/index.js" || config.assets?.directory !== "dist/client" || config.no_bundle !== true || !config.compatibility_flags?.includes("nodejs_compat")) fail("Deploy the built Worker and client assets together using the example configuration.");
  const root = dirname(resolve(file));
  if (artifacts && (!existsSync(resolve(root, config.main)) || !existsSync(resolve(root, config.assets.directory)))) fail("Run npm run build before preflight.");
  if (!db.migrations_dir || !existsSync(resolve(root, db.migrations_dir))) fail("Migration directory does not exist.");
  if (db.migrations_dir === "drizzle") fail("The development migration directory contains seeds; use a reviewed production migration directory.");
  return { config, db, origin: url.origin, pendingPolicy };
}

export function assertSeparate(staging, production) {
  if (staging.config.vars.APP_ENV !== "staging" || production.config.vars.APP_ENV !== "production") throw new Error("Compare staging first, production second.");
  for (const [a, b] of [[staging.config.name, production.config.name], [staging.db.database_id, production.db.database_id], [staging.db.database_name, production.db.database_name], [staging.origin, production.origin]]) {
    if (a.toLowerCase() === b.toLowerCase()) throw new Error("Staging and production must use separate Worker names, database IDs/names, and origins.");
  }
}
