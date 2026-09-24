# Launch tooling: commands and limits

This is the executable companion to [EXTERNAL-SETUP.md](EXTERNAL-SETUP.md). Run commands from the project root. Node 22.13+ and the pinned pnpm version are required. No command in this guide should be treated as evidence that an untested external service is ready.

## 1. Install and check

```powershell
npx --yes pnpm@11.25.0 install --frozen-lockfile
npm run check
npm run test:browser:install
npm run test:browser
```

On a clean clone, initialize the local database before browser tests:

```powershell
npx wrangler d1 migrations apply site-creator-d1 --local --config wrangler.migrations.jsonc
```

The browser runner starts the development server or uses an existing server at `http://localhost:5173`. It first runs the HTTP/security and four API suites, then desktop Chromium, Firefox, WebKit, and mobile Chromium/WebKit layouts. Browser fixtures are temporary, run sequentially, use a synthetic per-run address for limiter isolation, and remove their exact data and limiter keys. Never run a build or another fixture suite at the same time. The direct fixture adapter refuses remote targets and ambiguous local database files.

The suite checks login and recovery form navigation, admin redirects and error feedback, student post persistence, likes/bookmarks, dialogs, profile changes, logout, horizontal overflow and automated WCAG checks. WebKit emulation is not an actual iPhone/Safari test. Staging email delivery and complete device acceptance remain separate.

For one browser without repeating already-passed API dependencies:

```powershell
npm run test:browser -- --project=chromium --no-deps
```

Reports are in ignored `playwright-report/` and `test-results/`. They can contain test sessions and page content; only use synthetic accounts and do not publish reports openly. CI retains failure evidence for seven days.

## 2. Generate environment configuration

Replace each value below with the resources you own. These values are identifiers, not secret API keys.

```powershell
$env:DEPLOY_WORKER_NAME='campuscrate-echo-staging'
$env:DEPLOY_DB_NAME='campuscrate-echo-staging'
$env:DEPLOY_DB_ID='YOUR_REAL_D1_UUID'
$env:DEPLOY_APP_URL='https://YOUR_STAGING_HOSTNAME'
$env:DEPLOY_EMAIL_FROM='CampusCrate Echo <accounts@YOUR_VERIFIED_DOMAIN>'
npm run deploy:config -- staging
```

This creates `deployment.staging.local.jsonc` exclusively: it refuses to overwrite a file. Use a separate set of values with `production` to create `deployment.production.local.jsonc`. Both files are ignored. No infrastructure is created.

After building, validate both environments and their separation:

```powershell
npm run deploy:check -- deployment.staging.local.jsonc deployment.production.local.jsonc
```

Validation rejects placeholder IDs, shared names/IDs/origins, insecure origins, secrets in plain vars, local authentication, development migrations and missing build artifacts. It cannot establish DNS ownership, installed secrets or email-domain verification. A reviewed migration directory for an existing database may differ from the fresh baseline; see [DEPLOYMENT.md](DEPLOYMENT.md).

## 3. Generate an administrator safely

The script prints SQL only. It never modifies any database. Enter a unique password of at least 12 characters interactively:

```powershell
$adminSecurePassword = Read-Host 'New administrator password' -AsSecureString
$adminCredential = [pscredential]::new('unused', $adminSecurePassword)
$adminCredential.GetNetworkCredential().Password | node scripts/seed-admin.mjs --password-stdin 'YOUR_ADMIN_EMAIL' 'Primary Admin' super_admin
Remove-Variable adminCredential, adminSecurePassword
```

The password is transiently converted for hashing but is not written in the command text. Protect the generated SQL too: it contains an email address and password hash. Save it in an access-restricted, ignored file, review it, and execute that file against the intended environment using Wrangler's `--file`, actual database name, and deployment config. Do not paste generated SQL into an unquoted shell command. Never run `wrangler.migrations.jsonc` against a remote database. Repeat for the second recovery administrator with different credentials.

## 4. Back up and rehearse an export locally

Export requires an authenticated Cloudflare account. It reads the remote database and writes sensitive files under ignored `backups/`:

```powershell
npm run backup:export -- deployment.production.local.jsonc
npm run backup:verify -- backups/PRODUCTION_BACKUP_FOLDER/database.sql
```

The export tool invokes the installed Wrangler, restores the export into an isolated in-memory SQLite database, checks required tables, database integrity, foreign keys and table counts, then writes a checksum manifest. A failed export or verification is not a usable backup. Verification accepts only trusted operator-created SQL. The local verifier is limited to 256 MiB; larger exports need a dedicated isolated recovery environment.

Checksums detect changes; they do not encrypt or authenticate files. Apply restrictive Windows ACLs, encrypt backups and manifests, and copy them to operator-approved separate storage. Do not upload database exports to GitHub artifacts. A local restore verifies SQL consistency, not Cloudflare D1 compatibility or recovery time. Follow the remote recovery drill in [OPERATIONS-RUNBOOK.md](OPERATIONS-RUNBOOK.md) before launch.

## 5. Health and bounded load checks

```powershell
npm run health:check -- https://YOUR_STAGING_HOSTNAME
npm run test:load -- http://localhost:5173 2 20
npm run test:load -- https://YOUR_STAGING_HOSTNAME 5 100 deployment.staging.local.jsonc
```

Health checks inspect database readiness, the HTML page, CSP, MIME protection and HTTPS HSTS. They exit nonzero on failure and do not print response bodies. Connect this command to an external scheduler and alert destination that can notify the operator even when the app is down.

Load smoke defaults to 20 anonymous health requests with two concurrent workers. Hard limits are 200 requests and ten workers. Remote targets must exactly match an explicit staging configuration; production is refused. The report records failures and p50/p95 latency. This is an endpoint smoke test, not a measurement of authenticated feed, messaging, password hashing or chess capacity. Run realistic pilot journeys separately on staging and measure provider usage.

## 6. GitHub workflows

`verify.yml` runs code checks and a separate browser/API job on pushes and pull requests. It requires no production secrets.

`monitor.yml` runs the anonymous health/page probe on a five-minute schedule when the repository variable `MONITOR_APP_URL` is set. Without that variable the job is skipped. Configure workflow-failure notifications for the on-call owner and deliberately test a failure before relying on it. GitHub scheduling can be delayed or disabled; use a dedicated external uptime service if a strict detection window is required.

`deploy.yml` is manually triggered, restricted to `main`, serialized per environment, and performs checks, config generation, dry-run packaging, publishing and a post-deployment probe. Production additionally requires the acceptance checkbox. The workflow does not apply migrations or create email secrets. A failed post-deployment probe requires operator investigation; it does not automatically roll back a potentially incompatible schema.

Before using deployment, create GitHub environments `staging` and `production`, configure allowed branches and production reviewers, and add:

| Type | Names |
| --- | --- |
| Environment variables | `DEPLOY_WORKER_NAME`, `DEPLOY_DB_NAME`, `DEPLOY_DB_ID`, `DEPLOY_APP_URL`, `DEPLOY_EMAIL_FROM` |
| Environment secrets | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` |
| Worker secret, provisioned separately | `EMAIL_API_KEY` |

Limit the Cloudflare token to the intended account and required deployment permissions. Configure branch protection to require Verify jobs. The manual deployment workflow also runs the local browser/API suite on its checked-out revision before building and publishing; actual staging acceptance still needs the release record. Record the reviewed commit, migration ledger and recovery point. This workspace has no Git repository metadata; creating/pushing the repository and enabling GitHub settings remain external tasks.

Implementation references: [Playwright projects](https://playwright.dev/docs/test-projects), [Playwright web server](https://playwright.dev/docs/test-webserver), [D1 export/import](https://developers.cloudflare.com/d1/best-practices/import-export-data/), [GitHub deployment environments](https://docs.github.com/en/actions/concepts/workflows-and-actions/deployment-environments).
