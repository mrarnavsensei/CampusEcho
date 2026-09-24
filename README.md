# CampusCrate Echo

College social app and separate admin dashboard using React, Vinext, Cloudflare Workers, D1 and Drizzle.

## Run locally

Use Node.js 22.13+ (Node 24 recommended) and the pinned pnpm version.

```bash
pnpm install --frozen-lockfile
npm run db:migrate:local
npm run dev
```

App: **http://localhost:5173**. Admin: **http://localhost:5173/admin/login**.
The sign-in screen offers an explicit local development account, available only on loopback in development. Administrator and student sessions are separate. Existing local administrator records are preserved; the repository contains no default administrator password.

## Implemented

- College-scoped anonymous/identified posts, polls, likes, saves, comments, search and cursor pagination.
- Editable profiles, initial avatars, follow/unfollow, privacy, block/unblock and account-deactivation/deletion requests.
- Persisted one-to-one messaging, retry deduplication, read status, reporting, deletion and pagination. Updates use polling.
- Student password login, verified-email enforcement, one-use verification/reset tokens, sessions and logout. Registration/email delivery require Resend configuration.
- Untimed server-validated multiplayer chess, bounded practice AI, saved games and period/college/global community standings. These are participation points, not official Elo or tournament pairing.
- Admin user restrictions and enrollment review, report moderation, events, colleges/domains, analytics, settings, roles and transactional audit records on the same D1 database.
- No personalized HTML in the offline cache; script nonces, same-origin mutation checks, hashed sessions, persistent rate limits and server authorization.

Voice is explicitly unavailable; see the [integration plan](docs/EXTERNAL-SETUP.md). Uploads and background push are not implemented; the current experience uses text and initial avatars. Private profiles retain existing followers and reject new follows. Messages are not end-to-end encrypted. Routine moderation screens withhold private-message bodies and anonymous-author mappings.

## Verification

```bash
npm run check
# With the local development server running; creates and cleans random local test fixtures:
npm run test:integration
node scripts/test-http-smoke.mjs
# Installs/runs Chromium, Firefox and WebKit desktop/mobile emulation checks:
npm run test:browser:install
npm run test:browser
```

Integration scripts refuse remote targets. See [verification results](docs/VERIFICATION.md). Avoid production builds while integration suites use the development server: generated framework files can restart its worker.

On memory-constrained Windows machines, set `TEST_DB_BACKEND=sqlite` before the integration command (PowerShell: `$env:TEST_DB_BACKEND='sqlite'`). This optional fixture adapter opens the single existing workspace-local D1 SQLite file, seeds/cleans random fixtures transactionally, and avoids starting an extra Worker for each fixture query. All application assertions still use HTTP and the app's real D1 binding. It refuses ambiguous databases or paths outside the workspace; it is not an application database adapter.

## Environments and deployment

Use ignored `.dev.vars` for local Worker secrets; `.env.example` lists only consumed variables. Configure staging/production values through Cloudflare secrets. Never put credentials in `NEXT_PUBLIC_*`.

The local migration history contains development seeds and an unsafe conversion for populated legacy `0000` databases. **Do not use the local migration directory for a new production deployment.** A tested empty baseline in `drizzle-production/` starts with registration closed and manual enrollment review enabled. Existing installations through `0004` use reviewed incremental migrations instead of this baseline.

Follow [deployment and recovery](docs/DEPLOYMENT.md). Production hosting, credentials, actual email delivery, real-device acceptance, monitoring, legal policies and support require operator setup. This workspace has not been deployed or remotely capacity-tested; the supplied bounded load smoke only probes health readiness.

## Project map

For the launch handoff, start with [remaining work](docs/LAUNCH-STATUS.md), [tested launch tooling](docs/LAUNCH-TOOLING.md), [operations runbook](docs/OPERATIONS-RUNBOOK.md), and [operator policy drafts](docs/POLICY-DRAFTS.md).

`app/`: routes/admin UI. `components/echo/`: connected student screens. `components/chess/`: chess UI. `lib/`: identity, authorization and services. `db/`: typed schema. `drizzle/`: local/upgrading migrations. `tests/` and `scripts/test-*-integration.mjs`: verification.

[Original audit](docs/IMPLEMENTATION-AUDIT.md) · [Architecture](docs/ARCHITECTURE.md) · [External setup](docs/EXTERNAL-SETUP.md)
