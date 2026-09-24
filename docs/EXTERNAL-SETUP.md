# CampusCrate Echo — external setup and launch guide

Last reviewed: **24 September 2026**

This guide covers the work that must happen outside the codebase before CampusCrate Echo can accept real users. Complete it in order: **staging first, production second**.

Local automation is now available: [launch commands and CI/CD](LAUNCH-TOOLING.md), [operations and recovery runbook](OPERATIONS-RUNBOOK.md), and [policy drafts for operator review](POLICY-DRAFTS.md). Check [remaining launch work](LAUNCH-STATUS.md) for the current handoff. Prepared scripts and drafts do not mean that external setup has been completed; the checkboxes below require actual execution evidence.

The repository already contains the student app, admin dashboard, authentication, social features, messaging, events, chess, database migrations, and deployment tooling. The following items still require accounts, credentials, DNS, operational decisions, or additional integrations.

> Prices and provider limits below are planning references in USD before tax. Check the linked provider pages before purchasing. A free allowance is not a reliability guarantee.

## Start here: choose your launch scope

For the first launch, use the smallest practical scope.

### Recommended first release: text-first pilot

Enable:

- Student registration, email verification, and manual enrollment review
- Feed, polls, comments, profiles, follows, blocking, and reporting
- One-to-one messaging using the existing polling implementation
- Events and casual chess
- Admin moderation and account management

Keep unavailable:

- Live voice spaces
- Image/file uploads
- Push notifications
- Paid chess competitions or prizes

These optional features require additional engineering or operational review. Do not enable them by adding environment variables alone.

### Minimum services for the text-first pilot

| Service | Purpose | Required now? | Planning reference |
| --- | --- | --- | --- |
| Cloudflare Workers | Hosts the frontend, server rendering, and APIs on one origin | Yes | Free plan has limits; paid usage currently starts around $5/month. [Pricing](https://developers.cloudflare.com/workers/platform/pricing/) |
| Cloudflare D1 | Stores users, posts, messages, reports, events, and chess games | Yes | Usage-based storage and row reads/writes. [Pricing](https://developers.cloudflare.com/d1/platform/pricing/) |
| Domain and DNS | Provides the public HTTPS address used by cookies and email links | Yes | Depends on registrar and TLD |
| Resend | Sends verification and password-reset email | Yes, before public registration | Free and paid plans have sending limits. [Pricing](https://resend.com/pricing) |
| Uptime/log monitoring | Alerts an operator when the service fails | Yes | Provider limits and external monitor pricing vary |
| Separate backup storage | Retains database exports outside the active database | Recommended | Depends on storage and retention |
| LiveKit | Provides WebRTC audio infrastructure | Only if voice is implemented | Usage/concurrency based. [Pricing](https://livekit.com/pricing) |
| Cloudflare R2 | Stores future avatars/files/exports | Only if uploads are implemented | Storage and operation based. [Pricing](https://developers.cloudflare.com/r2/pricing/) |
| Turnstile | Adds bot challenges to sensitive forms | Optional when abuse warrants it | A free plan is available. [Plans](https://developers.cloudflare.com/turnstile/plans/) |

For early budgeting, estimate from actual requests, emails, stored data, and active users—not registered-user count alone. Voice should be budgeted separately using participant minutes.

---

## Phase 1 — assign ownership and create accounts

Do this before creating infrastructure.

- [ ] Name a technical owner for deployments, secrets, database changes, and recovery.
- [ ] Name an operations owner for email delivery, user support, moderation, and incident response.
- [ ] Name a legal/privacy reviewer for policies, retention, age rules, and data requests.
- [ ] Create an operator-owned Cloudflare account.
- [ ] Create an operator-owned Resend account.
- [ ] Enable MFA on both accounts.
- [ ] Add recovery contacts and store recovery codes securely.
- [ ] Configure billing alerts and renewal reminders.
- [ ] Give each team member an individual account with the minimum required role. Do not share one administrator login.
- [ ] Decide the canonical production hostname, for example `echo.campuscrate.in`.
- [ ] Choose a separate staging hostname, for example `staging-echo.campuscrate.in`.

**Phase complete when:** account recovery works, ownership is documented, and staging and production hostnames have been selected.

---

## Phase 2 — prepare the project locally

Run these commands from the repository root using Node.js 22.13 or newer and the pinned pnpm version.

```powershell
pnpm install --frozen-lockfile
npm run check
```

Expected result: type checking, unit/database tests, lint, and the production build all pass. Generated files should exist at:

- Worker entry: `dist/server/index.js`
- Browser assets: `dist/client`

Do not continue if the build fails. The latest local evidence and known limitations are recorded in [VERIFICATION.md](./VERIFICATION.md).

**Phase complete when:** `npm run check` finishes successfully on the exact revision intended for staging.

---

## Phase 3 — create an isolated staging environment

Staging must have its own Worker, D1 database, hostname, secrets, and test accounts. Never point staging at production data.

### 3.1 Authenticate and create the staging database

```powershell
npx wrangler login
npx wrangler d1 create campuscrate-echo-staging
```

Copy the database UUID printed by Cloudflare. It is not a secret, but it must identify the correct database.

### 3.2 Create the deployment configuration

Generate the ignored `deployment.staging.local.jsonc` from the example using `npm run deploy:config -- staging` and the environment variables documented in [LAUNCH-TOOLING.md](LAUNCH-TOOLING.md#2-generate-environment-configuration). The generator refuses to overwrite an existing file.

Required staging values:

```jsonc
{
  "name": "campuscrate-echo-staging",
  "vars": {
    "APP_ENV": "staging",
    "ENABLE_LOCAL_AUTH": "false",
    "APP_URL": "https://staging-echo.campuscrate.in",
    "EMAIL_FROM": "CampusCrate Echo <accounts@mail.campuscrate.in>"
  },
  "d1_databases": [{
    "binding": "DB",
    "database_name": "campuscrate-echo-staging",
    "database_id": "THE_REAL_STAGING_D1_UUID",
    "migrations_dir": "drizzle-production"
  }]
}
```

Important rules:

- The binding must be named `DB`; the application reads `env.DB`.
- `ENABLE_LOCAL_AUTH` must be the string `"false"` on every public deployment.
- `APP_URL` must be the exact HTTPS origin with no path, query, or trailing application route.
- Deploy the Worker and `dist/client` assets together. This is not a static-only application.
- Keep student and admin APIs on the same origin. Do not add wildcard CORS.
- Never put secrets in `vars`, `NEXT_PUBLIC_*`, committed files, screenshots, or build logs.

### 3.3 Run the deployment preflight

```powershell
node scripts/check-deployment.mjs deployment.staging.local.jsonc
npx wrangler deploy --dry-run --config deployment.staging.local.jsonc
```

The first command validates important local configuration. The dry run packages the Worker but does not publish it.

**Phase complete when:** both commands pass and the configuration points only to staging resources.

---

## Phase 4 — initialize the staging database safely

Choose exactly one migration path.

### Path A: new empty database — recommended

Use this for a new staging or production database. The `drizzle-production` baseline contains the current schema without development users, administrators, or sample colleges. Registration starts closed, manual review starts enabled, and voice starts disabled.

```powershell
npx wrangler d1 migrations list campuscrate-echo-staging --remote --config deployment.staging.local.jsonc
npx wrangler d1 migrations apply campuscrate-echo-staging --remote --config deployment.staging.local.jsonc
```

Inspect the output and confirm the target database name before approving the migration.

### Path B: existing installation already through migration 0004

Do not apply the fresh baseline. Export the database, restore it into a separate rehearsal database, inspect its migration ledger, and apply only reviewed incremental migrations `0005` through `0008` using an environment-specific configuration.

### Path C: populated legacy 0000 database

Stop and write a dedicated data migration. Historical migration `0001_loose_stellaris.sql` references fields missing from populated `0000` tables and is unsafe for an unreviewed production conversion. Rehearse a field-by-field mapping on a copy, reconcile row counts and ownership, then obtain operator approval.

### Required database checks

- [ ] Confirm production/staging contains no `sites.test` identities or sample colleges.
- [ ] Confirm foreign-key checks pass.
- [ ] Confirm registration is disabled until email and review workflows are ready.
- [ ] Record the migration name, time, operator, target database ID, and application build.
- [ ] Export the database or record a recovery bookmark before future schema changes.

See [DEPLOYMENT.md](./DEPLOYMENT.md) for migration and rollback details.

**Phase complete when:** the staging database has the correct schema, no development identities, and a recorded recovery point.

---

## Phase 5 — create administrators and colleges

### 5.1 Create the first Super Admin

Use a unique password of at least 12 characters stored in the operator password manager.

```powershell
node scripts/seed-admin.mjs --password-stdin admin@campuscrate.in "Primary Admin" super_admin
```

Supply the password through standard input using the secure PowerShell example in [LAUNCH-TOOLING.md](LAUNCH-TOOLING.md#3-generate-an-administrator-safely). The script prints SQL only; it does not modify a database. Review the SQL and apply it with the intended deployment configuration and database name. The script no longer prints a remote command referencing the development configuration.

After creation:

- [ ] Sign in at `/admin/login` on the staging hostname.
- [ ] Create a second, individually assigned recovery-capable Super Admin.
- [ ] Create narrower `moderator`, `support_admin`, and `event_manager` accounts as needed.
- [ ] Verify each role can access only its permitted pages and actions.
- [ ] Store administrator credentials in a password manager; never commit them.

### 5.2 Add approved colleges

In College Management:

1. Create the institution.
2. Add only domains controlled by that institution.
3. Define whether mailbox verification is sufficient for initial access or whether manual evidence is required.
4. Assign reviewers and a response-time target.
5. Define how rejected applicants, expired evidence, alumni, and appeals are handled.

A verified college email proves mailbox access; it does not prove current enrollment or age.

**Phase complete when:** at least two Super Admins exist, staff roles are tested, and approved institutions have a documented verification process.

---

## Phase 6 — configure transactional email

Public registration and password recovery should remain closed until this phase passes.

### 6.1 Verify the sending domain

1. Add a dedicated transactional domain or subdomain in Resend, such as `mail.campuscrate.in`.
2. Add the exact DNS records shown by Resend.
3. Wait until Resend reports the domain as verified.
4. Configure SPF, DKIM, and an appropriate DMARC policy with the domain administrator.
5. Disable click/open tracking for verification and password-reset messages.

Provider guide: [Resend domain setup](https://resend.com/docs/dashboard/domains/introduction).

### 6.2 Add the server secret

Create a Resend API key with the narrowest available permission and store it in the staging Worker:

```powershell
npx wrangler secret put EMAIL_API_KEY --config deployment.staging.local.jsonc
```

Confirm these non-secret variables are already in the deployment configuration:

- `APP_URL=https://the-exact-staging-hostname`
- `EMAIL_FROM=CampusCrate Echo <accounts@the-verified-domain>`

The current adapter calls Resend directly. `EMAIL_API_URL` is not used.

### 6.3 Test real delivery

Using a real approved college mailbox in staging:

- [ ] Register and receive the verification message.
- [ ] Confirm the link uses the staging HTTPS hostname.
- [ ] Verify the token works once and rejects reuse.
- [ ] Confirm an expired token is rejected.
- [ ] Request a password reset and complete it.
- [ ] Test duplicate submissions and provider rejection.
- [ ] Check spam placement, bounce behavior, and sender alignment.
- [ ] Confirm passwords, cookies, API keys, and complete token URLs do not appear in logs.

Assign an owner to monitor quotas, bounces, complaints, and sender reputation. Bounce webhooks and general email notifications are not currently implemented.

**Phase complete when:** verification and recovery work with real mailboxes and provider failures produce safe, understandable errors.

---

## Phase 7 — deploy and connect the staging hostname

```powershell
npm run check
npx wrangler deploy --config deployment.staging.local.jsonc
```

Then configure a Cloudflare Worker Custom Domain for the staging hostname. Confirm DNS and the issued TLS certificate refer to the intended staging Worker. See [Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).

Verify:

- [ ] HTTP redirects to HTTPS.
- [ ] The canonical hostname matches `APP_URL` exactly.
- [ ] `/api/health` returns a healthy database result.
- [ ] Student and admin cookies are secure and scoped correctly.
- [ ] Local development login is unavailable.
- [ ] Direct access to protected student/admin pages is denied without a valid session.
- [ ] A frontend-only/static deployment was not created accidentally.

**Phase complete when:** staging is reachable over its final HTTPS hostname and all authentication links return to that hostname.

---

## Phase 8 — complete staging acceptance

Use approved disposable staging accounts. The repository's integration scripts intentionally refuse remote targets, so staging acceptance must be performed through the real UI and APIs without running local fixture scripts against staging.

### Student journeys

- [ ] Register, verify, sign in, sign out, reset password, and revoke other sessions.
- [ ] Complete or fail manual enrollment review as appropriate.
- [ ] Create anonymous and identified posts; confirm ordinary users cannot discover anonymous authors.
- [ ] Edit/delete posts and comments; like, save, vote, follow, block, report, and reload.
- [ ] Verify private and blocked content remains inaccessible through copied URLs.
- [ ] Send messages between two users, check read state, pagination, retries, deletion, reporting, and block restrictions.
- [ ] Register for an event and confirm capacity is not exceeded during simultaneous requests.
- [ ] Play AI and two-user chess, reload mid-game, reject illegal/out-of-turn moves, draw, resign, and check standings.

### Administrator journeys

- [ ] Test every admin role separately.
- [ ] Review reports, remove/restore content, record reasons, and inspect the audit trail.
- [ ] Approve/reject verification, suspend/reinstate users, and confirm sessions are revoked.
- [ ] Create and publish an event, then inspect real registrations.
- [ ] Confirm routine moderation does not expose private-message bodies or anonymous-author mappings.
- [ ] Confirm the last active Super Admin cannot be removed or demoted.

### Browser and device checks

- [ ] Test current Chrome, Edge, Firefox, and Safari where supported.
- [ ] Test at approximately 360/390px mobile and 1280/1440px desktop widths.
- [ ] Check keyboard navigation, visible focus, dialog focus/Escape, labels, errors, empty states, and loading states.
- [ ] Test slow connections, offline recovery, refresh, expired sessions, and back/forward navigation.
- [ ] Inspect browser console and network traffic for CSP failures or private-data leakage.

### Capacity and failure checks

- [ ] Measure expected pilot concurrency instead of assuming local tests prove capacity.
- [ ] Check Worker CPU, D1 reads/writes, response latency, email usage, and error rates.
- [ ] Simulate email-provider failure and database unavailability.
- [ ] Confirm hidden tabs do not produce unacceptable messaging/chess polling costs.

**Phase complete when:** results, browser versions, failures, and owner sign-off are recorded—not merely observed informally.

---

## Phase 9 — configure monitoring, backups, and incident response

### Monitoring

- [ ] Enable appropriate Workers logs and set a retention period. [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)
- [ ] Add an external HTTPS monitor for `/api/health` and a real page.
- [ ] Alert on 5xx errors, health failures, latency, login/email failures, D1 usage/storage, CPU, and billing thresholds.
- [ ] Route alerts to a named on-call person and test the notification path.
- [ ] Keep passwords, cookies, reset links, private messages, and anonymous-author mappings out of routine logs.

Third-party error monitoring is not connected. Adding `SENTRY_DSN` alone does nothing; an SDK, redaction rules, source-map policy, and alert ownership must be implemented first.

### Backup and recovery

- [ ] Define the recovery point objective (acceptable data loss).
- [ ] Define the recovery time objective (acceptable outage duration).
- [ ] Record D1 Time Travel bookmarks before releases and migrations where available. [D1 recovery](https://developers.cloudflare.com/d1/reference/time-travel/)
- [ ] Export protected database copies to separate storage according to the retention policy.
- [ ] Restore an export into a separate staging database.
- [ ] Verify users, ownership, messages, moderation records, audits, and health after restore.
- [ ] Document who may pause writes and switch the Worker binding during recovery.

Rolling back the Worker does not undo database writes. Prefer additive migrations and forward fixes; coordinate data restoration with a write pause and reconciliation of emails or other provider events.

### Incident response

Document:

1. Who declares and leads an incident.
2. How access and secrets are revoked.
3. How evidence is preserved safely.
4. Which providers and institutional contacts are notified.
5. Who decides whether users or authorities must be notified.
6. How service restoration and post-incident review are recorded.

**Phase complete when:** an alert reaches a human and a restore drill has been completed successfully.

---

## Phase 10 — complete policy, moderation, and legal work

Code does not create legal compliance or a functioning safety operation. Obtain advice for the real operator, user ages, launch regions, and business model.

### Documents and processes to publish

- [ ] Privacy notice
- [ ] Terms of service
- [ ] Community guidelines
- [ ] Support and grievance contact
- [ ] Account deletion request process
- [ ] Content reporting, moderation, appeal, and emergency escalation process
- [ ] Retention schedule for profiles, posts, messages, sessions, tokens, audits, provider logs, and backups
- [ ] Lawful data-request review and approval process
- [ ] Child/age and enrollment policy

Describe the product accurately:

- Anonymous posts hide authors from ordinary users, but backend records remain linkable under restricted access.
- Messages are not end-to-end encrypted.
- Deactivation is not the same as permanent deletion.
- Routine admin tools intentionally withhold private-message bodies and anonymous-author mappings.

### India-specific review

Ask Indian counsel to review at least:

- The **Digital Personal Data Protection Act, 2023**, the final **DPDP Rules, 2025**, commencement notifications, and later amendments/corrigenda. Review notices, consent, security, rights, processors, children, and exemptions. [Official Act](https://www.meity.gov.in/static/uploads/2024/02/Digital-Personal-Data-Protection-Act-2023-1.pdf), [final Rules Gazette](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf), [MeitY policy index](https://www.meity.gov.in/documents/act-and-policies)
- The current **Information Technology Rules**, including applicable grievance, takedown, preservation, and synthetic-content duties. [MeitY publications](https://www.meity.gov.in/documents/act-and-policies)
- Applicable **CERT-In** directions, including incident reporting, contact, and log retention/location requirements. [Official directions](https://www.cert-in.org.in/PDF/CERT-In_Directions_70B_28.04.2022.pdf)

Some college students may be under 18. A college email does not establish age, and the current app has no age-assurance or parental-consent integration. Decide the permitted age group and process with counsel before launch.

Before offering entry fees, prizes, or international access, obtain additional gaming, tax, consumer, child-safety, privacy, and cross-border processing review. The current chess feature is casual play, not a certified competitive or anti-cheat platform.

**Phase complete when:** policies are published, responsible people are named, workflows are rehearsed, and legal review covers the actual launch—not a generic template.

---

## Phase 11 — create and launch production

Repeat the staging infrastructure steps with entirely separate production resources.

1. Create `campuscrate-echo-production` D1.
2. Generate `deployment.production.local.jsonc` with `npm run deploy:config -- production` and separate production values.
3. Set `APP_ENV="production"` and `ENABLE_LOCAL_AUTH="false"`.
4. Set production `APP_URL`, Worker name, D1 UUID, and verified sender.
5. Add production secrets independently; do not reuse staging keys unless the provider design explicitly requires it.
6. Apply the correct database migration path.
7. Create two individually assigned production Super Admins.
8. Run preflight and dry-run packaging.
9. Take a recovery point and record the release version.
10. Deploy the reviewed build.
11. Connect the production Custom Domain and verify TLS/DNS.
12. Repeat the critical staging checks with controlled production test accounts.
13. Keep registration closed until the release owner signs the launch checklist.
14. Open registration gradually and watch health, errors, database usage, email delivery, abuse, support volume, and cost.

```powershell
npm run check
node scripts/check-deployment.mjs deployment.production.local.jsonc
npx wrangler deploy --dry-run --config deployment.production.local.jsonc
npx wrangler deploy --config deployment.production.local.jsonc
```

Use separate local configuration files or a controlled CI secret/configuration process when managing both staging and production. Confirm the target name and D1 UUID before every remote command.

---

## Optional feature roadmap

The following sections are implementation plans, not launch-ready integrations.

### Live voice spaces

Voice is currently unavailable. Stored room records and admin cleanup are not audio sessions. Recommended pilot provider: LiveKit Cloud, unless the team has proven WebRTC operations experience.

Implementation sequence:

1. Create separate LiveKit staging and production projects; choose region/residency and review quotas.
2. Store `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` server-side. Never expose the secret to browser code.
3. Implement a token endpoint that verifies the student session, campus, feature flag, bans, room state, role, and capacity. Tokens must be short-lived and scoped to one server-selected room and identity.
4. Define listener, speaker, host, and moderator permissions. Listeners cannot publish; approved speakers receive microphone-only publication rights.
5. Implement real client join/leave, remote audio, microphone permission, mute state, reconnection, device errors, and accessible controls.
6. Record bans before denying future tokens. Call provider removal/end APIs; changing D1 state alone does not disconnect audio.
7. Verify signed raw-body webhooks, deduplicate events, and reconcile delayed/missed events with provider state.
8. Set small room/speaker caps, idle/max-duration rules, creation/admission rate limits, and cost alerts.
9. Add reporting, host removal, and on-call procedures. Do not record audio by default.
10. Test two physical devices, Wi-Fi/mobile, restrictive campus networks/TURN, token expiry, reconnects, capacity races, removal/rejoin, host departure, provider outage, and replayed webhooks.

Useful references: [deployment and TURN](https://docs.livekit.io/transport/self-hosting/deployment/), [tokens/grants](https://docs.livekit.io/frontends/reference/tokens-grants/), [participant permissions](https://docs.livekit.io/intro/basics/rooms-participants-tracks/participants/), [webhooks](https://docs.livekit.io/intro/basics/rooms-participants-tracks/webhooks-events/).

Estimate participant minutes: 20 connected people for 30 minutes consume 600 participant minutes. Include concurrency, downstream media traffic, TURN traffic, recording, monitoring, and staff support. Self-hosting replaces subscription cost with servers, bandwidth, TLS, upgrades, capacity engineering, and incident response.

Do not enable voice until all audio/network tests pass.

### Image and file uploads

Current profile initials require no storage. A safe R2 integration needs:

- A private bucket and Worker binding
- Authenticated per-user ownership
- File-size and type limits
- Actual image decoding/re-encoding and metadata removal
- Malware/content review where appropriate
- Safe serving headers and bounded signed access
- Quotas and lifecycle cleanup
- Account-deletion and backup-retention behavior

Do not accept arbitrary public URLs or treat a stored `avatarKey` as a complete upload system. Keep enrollment evidence separate from public avatars and collect it only when necessary.

### Realtime messaging and chess

The current implementation uses polling and requires no `REALTIME_SECRET`. Before replacing it:

1. Measure latency and request cost under a realistic pilot.
2. Reduce hidden-tab polling where appropriate.
3. If necessary, add authenticated WebSocket channels with Durable Objects or a reviewed managed provider.
4. Keep D1 as the durable source of truth.
5. Recheck membership and blocks on every subscription and send.
6. Recover missed events by fetching current versioned state.

Chess AI currently runs as bounded server computation; no external AI key or Stockfish service is used. Timers, strong-engine hosting, tournaments, prizes, scheduling, brackets, and collusion/anti-cheat controls require separate work and load testing.

### Push notifications

In-app notifications already work; background push does not. A complete Web Push implementation needs VAPID keys, consent, subscription storage, server delivery, retry/expiry handling, service-worker behavior, and opt-out/deletion. Browsers still rely on their platform push endpoints even if the sender is self-hosted.

### CAPTCHA, external moderation, analytics, and error monitoring

- **CAPTCHA:** add only when abuse warrants it. A widget is ineffective without server-side token verification.
- **External moderation:** review provider cost, processing location, retention, and contracts before sending student text. Human review and appeals remain necessary.
- **Analytics:** avoid private message content, anonymous-author mappings, and unnecessary identifiers. Existing aggregate admin metrics may be sufficient for the pilot.
- **Error monitoring:** implement an SDK/transport, redaction, source-map policy, alert routing, and retention. An environment variable alone is not an integration.

---

## Environment variable reference

Only configure variables that the current application consumes.

| Name | Type | Required | Meaning |
| --- | --- | --- | --- |
| `DB` | D1 binding | Yes | Database binding named exactly `DB`; not a string environment variable |
| `APP_ENV` | Plain variable | Yes | `staging` or `production` on public deployments |
| `ENABLE_LOCAL_AUTH` | Plain variable | Yes | Must be `false` outside intentional loopback development |
| `APP_URL` | Plain variable | Yes | Exact canonical HTTPS origin used in verification/reset links |
| `EMAIL_FROM` | Plain variable | Yes for email | Sender on a verified Resend domain |
| `EMAIL_API_KEY` | Secret | Yes for email | Resend API key stored with Wrangler secrets |
| `MODERATION_API_URL` | Plain variable | Optional | Compatible external text-moderation endpoint |
| `MODERATION_API_KEY` | Secret | Optional | Credential for the moderation endpoint |
| `MODERATION_MODEL` | Plain variable | Optional | Model name accepted by the moderation provider |

`EMAIL_API_URL` is unused. `LIVEKIT_*`, `REALTIME_*`, `PUSH_*`, `SENTRY_DSN`, and `ANALYTICS_ID` do not create integrations unless corresponding code has been implemented and tested.

---

## Final go-live checklist

Do not open public registration until every applicable item is complete.

### Infrastructure

- [ ] Separate staging and production Workers, D1 databases, hostnames, and secrets
- [ ] Production preflight, dry run, build, migration, and deployment passed
- [ ] HTTPS, DNS, canonical redirects, cookies, and `/api/health` verified
- [ ] Local authentication disabled in every public environment

### Access and data

- [ ] Two individually assigned production Super Admins
- [ ] Least-privilege staff roles tested
- [ ] Approved colleges/domains and manual verification workflow configured
- [ ] Recovery point recorded; separate restore drill passed

### Product and safety

- [ ] Real verification and reset email delivery passed
- [ ] Critical student and admin journeys passed in staging
- [ ] Browser, mobile, accessibility, failure, and pilot-load checks recorded
- [ ] Monitoring and billing alerts reach an accountable person
- [ ] Moderation, support, appeals, deletion, and incident procedures staffed
- [ ] Privacy notice, terms, community rules, contacts, retention, and legal review complete

### Optional features

- [ ] Voice remains unavailable until the real integration and network tests pass
- [ ] Uploads remain unavailable until storage and content-safety controls pass
- [ ] Push/realtime/external monitoring are described according to actual implementation state
- [ ] No prizes or paid competition rely on the current casual chess standings

### Release control

- [ ] Named release owner approved the launch
- [ ] Previous compatible Worker version and rollback instructions are available
- [ ] Migration/restore contingency is written and understood
- [ ] Registration opens gradually with live monitoring and a documented stop condition
