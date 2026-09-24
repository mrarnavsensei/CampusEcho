import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { readDeployment, validateDeployment, assertSeparate } from "../scripts/deployment-config.mjs";
import { verifyExport, verifyManifest } from "../scripts/backup-core.mjs";
import { probe } from "../scripts/probe.mjs";
import { deliverAccountEmail, validEmailConfiguration } from "../lib/email-transport.ts";
import { readPolicyConfiguration } from "../lib/policy-config.ts";

const template = readDeployment("deployment.example.jsonc");
function configuration(environment = "staging") {
  const config = structuredClone(template);
  config.name = `echo-${environment}`;
  Object.assign(config.vars, { APP_ENV: environment, APP_URL: `https://${environment}.campuscrate.in`, EMAIL_FROM: "Echo <accounts@mail.campuscrate.in>" });
  if (environment === "production") {
    config.vars.POLICY_STATUS = "approved";
    for (const key of Object.keys(config.vars).filter(key => key.startsWith("POLICY_") && !["POLICY_STATUS", "POLICY_MINIMUM_AGE"].includes(key))) config.vars[key] = `Approved ${key}`;
  }
  Object.assign(config.d1_databases[0], { database_name: `echo-${environment}`, database_id: environment === "staging" ? "12345678-1234-4123-8123-123456789012" : "23456789-1234-4123-8123-123456789012" });
  return config;
}
test("deployment preflight rejects secrets, unsafe origins and development migrations", () => {
  const validate = (config: ReturnType<typeof configuration>) => validateDeployment(config, { artifacts: false });
  assert.throws(() => validate(template));
  assert.doesNotThrow(() => validate(configuration()));
  for (const origin of ["http://echo.campuscrate.in", "https://name:password@echo.campuscrate.in", "https://echo.campuscrate.in/path", "https://echo.campuscrate.in/?token=secret", "https://example.com", "https://localhost"]) {
    const config = configuration(); config.vars.APP_URL = origin; assert.throws(() => validate(config));
  }
  const secret = configuration(); secret.vars.EMAIL_API_KEY = "sensitive"; assert.throws(() => validate(secret));
  const local = configuration(); local.vars.ENABLE_LOCAL_AUTH = "true"; assert.throws(() => validate(local));
  const invalidAge = configuration(); invalidAge.vars.POLICY_MINIMUM_AGE = "unknown"; assert.throws(() => validate(invalidAge));
  const draftProduction = configuration("production"); draftProduction.vars.POLICY_STATUS = "draft"; assert.throws(() => validate(draftProduction), /POLICY_STATUS/);
  const incompleteProduction = configuration("production"); incompleteProduction.vars.POLICY_SUPPORT_CONTACT = "TO COMPLETE"; assert.throws(() => validate(incompleteProduction), /POLICY_SUPPORT_CONTACT/);
  const seeds = configuration(); seeds.d1_databases[0].migrations_dir = "drizzle"; assert.throws(() => validate(seeds));
  const staging = validate(configuration()), production = validate(configuration("production"));
  assert.doesNotThrow(() => assertSeparate(staging, production));
  production.db.database_id = staging.db.database_id;
  assert.throws(() => assertSeparate(staging, production));
  const missingTarget = spawnSync(process.execPath, ["scripts/check-deployment.mjs"], { encoding: "utf8" });
  assert.equal(missingTarget.status, 1);
  assert.match(missingTarget.stderr, /deployment\.staging\.local\.jsonc/);
});

test("policy configuration preserves placeholders as absent values and validates the age", () => {
  const draft = readPolicyConfiguration({ POLICY_STATUS: "draft", POLICY_OPERATOR_NAME: "TO COMPLETE", POLICY_MINIMUM_AGE: "21" });
  assert.equal(draft.approved, false);
  assert.equal(draft.operatorName, null);
  assert.equal(draft.minimumAge, 21);
  assert.equal(readPolicyConfiguration({ POLICY_MINIMUM_AGE: "not-a-number" }).minimumAge, 18);
});

test("backup restores schema and records in isolation; corruption and broken ownership fail", () => {
  const baseline = readFileSync("drizzle-production/0000_baseline.sql", "utf8");
  const sql = baseline + "\nINSERT INTO campuses(id,name,slug,status,created_at,updated_at) VALUES('restore_test','Attach test: user content is data','restore-test','active',1,1);";
  const result = verifyExport(sql);
  assert.equal(result.counts.campuses, 1);
  assert.doesNotThrow(() => verifyManifest(sql, { version: 1, ...result }));
  assert.throws(() => verifyManifest(sql + "-- changed", { version: 1, ...result }));
  assert.throws(() => verifyExport("CREATE TABLE users(id TEXT);"));
  assert.throws(() => verifyExport(sql + "\nPRAGMA foreign_keys=OFF; INSERT INTO profiles(user_id,handle,display_name,joined_at,updated_at) VALUES('missing','missing','Missing',1,1);"));
  assert.throws(() => verifyExport("ATTACH DATABASE '/tmp/other' AS other;"));
});

test("probe catches database failure, redirects and missing security headers", async () => {
  const healthy = async (input: URL | RequestInfo) => String(input).endsWith("/api/health") ? Response.json({ database: "reachable" }) : new Response("<html></html>", { headers: { "Content-Type": "text/html", "Content-Security-Policy": "default-src 'self'", "X-Content-Type-Options": "nosniff", "Strict-Transport-Security": "max-age=31536000" } });
  assert.equal((await probe("https://echo.campuscrate.in", { fetcher: healthy })).status, "ok");
  await assert.rejects(probe("https://echo.campuscrate.in", { fetcher: async () => new Response("", { status: 503 }) }));
  await assert.rejects(probe("https://echo.campuscrate.in", { fetcher: async () => new Response("", { status: 302 }) }));
  await assert.rejects(probe("https://echo.campuscrate.in", { fetcher: async () => Response.json({ database: "reachable" }) }));
});

test("email transport handles provider rejection, timeout and network failure without exposing details", async () => {
  const config = { APP_URL: "https://echo.campuscrate.in", EMAIL_API_KEY: "test-key", EMAIL_FROM: "test@campuscrate.in" };
  assert.equal(validEmailConfiguration({ ...config, APP_URL: "https://user:secret@echo.campuscrate.in" }), false);
  for (const status of [400, 401, 429, 500, 503]) {
    assert.equal(await deliverAccountEmail(config, "student@example.invalid", "a".repeat(64), "reset", async () => new Response("PRIVATE PROVIDER BODY", { status })), false);
  }
  for (const error of [new Error("private provider detail"), new DOMException("timed out", "TimeoutError")]) {
    assert.equal(await deliverAccountEmail(config, "student@example.invalid", "a".repeat(64), "verify", async () => { throw error; }), false);
  }
  assert.equal(await deliverAccountEmail(config, "student@example.invalid", "a".repeat(64), "verify", async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    assert.match(body.text, /https:\/\/echo.campuscrate.in\/#verify=/);
    assert.ok(init?.signal);
    return Response.json({ id: "fixture" });
  }), true);
});

test("admin bootstrap supports stdin, emits SQL only and rejects weak passwords", () => {
  const args = ["scripts/seed-admin.mjs", "--password-stdin", "operator@example.invalid", "Test Operator", "moderator"];
  const password = "Random-test-password-321";
  const result = spawnSync(process.execPath, args, { input: password, encoding: "utf8" });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /^INSERT INTO admin_accounts/);
  assert.ok(!result.stdout.includes(password));
  assert.ok(!result.stdout.includes("--remote"));
  assert.equal(spawnSync(process.execPath, args, { input: "12345", encoding: "utf8" }).status, 1);
});
