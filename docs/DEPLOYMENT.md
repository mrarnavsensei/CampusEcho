# Deployment, migrations and recovery

## Current state

This repository produces a Cloudflare Worker plus browser assets. Nothing has been deployed by this implementation. The checked-in D1 UUID is a local placeholder. A real Cloudflare account, database, domain and email sender are required. Registration should remain closed until the external setup checklist is complete.

Use separate databases, Worker names, domains and secrets for staging and production. Student and admin APIs are same-origin; wildcard CORS is unnecessary. Do not expose the local development server to the public internet.

## Build and preflight

1. Install the pinned dependencies with `pnpm install --frozen-lockfile` using Node 22.13+.
2. Run `npm run check`. This checks types, unit/database tests, lint and build. The generated entry is `dist/server/index.js`; assets are in `dist/client`.
3. Generate the ignored `deployment.staging.local.jsonc` as described in [LAUNCH-TOOLING.md](LAUNCH-TOOLING.md#2-generate-environment-configuration). Set the Worker name, actual D1 UUID/name, APP_URL and verified email sender; keep `ENABLE_LOCAL_AUTH=false` everywhere public. Generate `deployment.production.local.jsonc` separately with different resources.
4. Run `npm run deploy:check -- deployment.staging.local.jsonc deployment.production.local.jsonc`. It deliberately rejects placeholders and shared staging/production resources. This is a configuration check; it does not validate DNS, secrets, account ownership or legal readiness and does not deploy.
5. Inspect the staging artifact without publishing using `npx wrangler deploy --dry-run --config deployment.staging.local.jsonc`.

For day-to-day local use, run `npm run dev` and allow the first dependency scan to finish; observed cold starts took up to about 70 seconds. `npm start` runs the built artifact through Wrangler's local proxy, not through deployed Cloudflare infrastructure. See VERIFICATION.md for the unresolved local preview POST/network failure; its full API suite has not passed. Staging acceptance on the actual HTTPS hostname is still required.

No secrets belong in build-time public variables. Use `npx wrangler secret put EMAIL_API_KEY --config deployment.staging.local.jsonc` after authenticating to the intended Cloudflare account, and repeat with `deployment.production.local.jsonc` only when production is approved. Optional moderation secrets use `MODERATION_API_KEY`. APP_URL and EMAIL_FROM are non-secret Worker vars. `.dev.vars` is ignored and is only for local use. Setting `LIVEKIT_*` alone does not enable audio.

## Choose the correct migration path

### New empty staging or production database

Create a D1 database through the operator's Cloudflare account. The template points to `drizzle-production/`, whose single baseline contains the final schema with no student/admin/campus seeds. Its defaults close registration, require manual enrollment review and keep voice disabled.

```bash
npx wrangler d1 migrations list campuscrate-echo-staging --remote --config deployment.staging.local.jsonc
npx wrangler d1 migrations apply campuscrate-echo-staging --remote --config deployment.staging.local.jsonc
```

Replace the database name with the one configured for that environment. These commands change the remote database and should only be run after checking the account and target. Do not apply the fresh baseline to a non-empty installation. `scripts/schema-baseline.mjs` constructs this schema from an empty in-memory database; it never copies local user data. A unit test verifies the baseline, empty identities, foreign keys and closed-registration defaults.

### Existing installation through local migration 0004

Export and rehearse on a copy. Apply only the unapplied reviewed migrations 0005–0008, preserving its migration ledger and the current schema. Inspect the ledger and indexes first. Do not switch an existing installation to the fresh-baseline directory: that would try to recreate its tables. Use an environment-specific migration configuration containing the actual database ID and the reviewed upgrade directory.

### Populated legacy 0000 installation

**Stop before historical 0001.** Its old table-copy statements reference missing columns; SQLite compatibility can convert quoted names into string values. Fresh database tests do not validate that data conversion. Preserve the original and write an explicit field mapping on a copy, reconcile counts/ownership/timestamps/foreign keys, then obtain operator review before migration. This workspace had already passed this historical migration; existing local data has not been reset.

### Future schema changes

Handwritten migrations are authoritative. The historical Drizzle snapshot journal does not include all later handwritten migrations. Reconcile snapshots in an isolated scratch environment before using `db:generate`; inspect every generated statement. Never use an automatic destructive schema push for production. Prefer additive changes that allow the previous Worker version to remain compatible.

## Bootstrap and staging acceptance

The seed-admin script emits an INSERT with a salted password hash; it does not execute remote commands. Use `--password-stdin` as described in [LAUNCH-TOOLING.md](LAUNCH-TOOLING.md), and apply its SQL to the intended database using its deployment configuration. Avoid shared credentials and shell-history exposure; manage production credentials in the operator's password manager. Keep at least two individually assigned recovery-capable Super Admins and assign narrower roles to staff. No default admin account is included in the fresh baseline.

Add actual approved colleges/domains through College Management. Establish the manual enrollment review workflow, publish the actual policies and support contact, and configure a verified Resend sender. Email verification establishes mailbox access, not student enrollment or age. Registration starts closed; enable it in Admin Settings only after real delivery and the review workflow pass staging acceptance.

Run integration scripts only against the local clone: they intentionally refuse remote URLs. Staging acceptance must use separately approved disposable test accounts with actual mailboxes. Check login/reset, two-user feed/privacy/DM behavior, moderation, account restriction, chess and event capacity. Repeat browser/device acceptance from VERIFICATION.md. Probe `/api/health`; it returns 503 if required database tables cannot be queried.

## Publish and observe

When staging acceptance and the external checklist are complete, deploy the reviewed artifact with the exact target file (`npx wrangler deploy --config deployment.staging.local.jsonc` or `deployment.production.local.jsonc`). Configure the canonical HTTPS custom domain through Cloudflare and confirm APP_URL matches it. Keep staging and production resources separate. GitHub verification and manually triggered deployment workflows are supplied; they require repository/environment setup and credentials before use. See [LAUNCH-TOOLING.md](LAUNCH-TOOLING.md#6-github-workflows).

Configure alerts for health failures, 5xx rates, login failures, email failures, CPU/latency, database reads/writes/storage and billing. Measure a realistic pilot workload before opening enrollment. Password hashing and server AI need CPU headroom; polling creates recurring requests per active viewer. No load/concurrency capacity claim is established by unit or local API tests. Logs must not record passwords, cookies, email token URLs, private messages or anonymous-author mappings.

## Backup and rollback

Before each migration, export the target database and record its D1 recovery bookmark where available. Protect exports separately, with an owner and retention period. Test restoration into a separate database; verify data counts, ownership, sessions, audits and health before switching bindings. D1 Time Travel windows are plan-dependent; see EXTERNAL-SETUP.md for current provider references.

Keep the previous Worker version and its configuration. For an application regression, roll back the Worker only if it is compatible with the current schema. A Worker rollback does not undo writes or migrations. For corruption, pause writes/registration, preserve incident evidence, restore into a new database, reconcile legitimate newer writes and provider side effects, then switch the binding and verify. Do not overwrite the original database as the first recovery step.

Account deletion requests immediately deactivate access and hide content. The operator must define lawful retention, review holds and execute/document permanent removal and backup expiry. This release does not claim an automated purge job or completed legal compliance.
