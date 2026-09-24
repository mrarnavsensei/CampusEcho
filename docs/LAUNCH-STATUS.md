# Launch handoff — 24 September 2026

Scope: the text-first pilot described in [EXTERNAL-SETUP.md](EXTERNAL-SETUP.md). Voice, uploads, background push, paid tournaments and additional third-party integrations remain outside this release. Readiness is determined by evidence and approval, not a percentage estimate.

## Local deliverables completed

| Deliverable | Where to find it | What it does |
| --- | --- | --- |
| Staging/production config generator and preflight | `scripts/create-deployment.mjs`, `scripts/check-deployment.mjs` | Validates values, prevents accidental overwrite, rejects development migrations/plaintext secrets, checks environment separation |
| CI verification and manual deployment workflow | `.github/workflows/verify.yml`, `deploy.yml` | Runs code checks and browser/API tests; separately supports operator-triggered deployment |
| Availability probe and scheduled workflow | `scripts/check-health.mjs`, `.github/workflows/monitor.yml` | Checks D1 readiness, HTML and security headers; monitoring requires URL and notifications |
| Backup export, checksum and isolated restore verification | `scripts/backup.mjs`, `scripts/backup-core.mjs` | Checks trusted exports without changing the live database |
| Bounded load smoke | `scripts/load-smoke.mjs` | Reports latency/failures on local or explicitly configured staging health endpoint |
| Browser and accessibility automation | `playwright.config.mjs`, `tests/browser/` | Exercises core interactions across desktop/mobile engines, isolates synthetic rate limits, and verifies reload/focus/WCAG behavior repeatably |
| Failure and account-deletion tests | `tests/launch-tooling.test.ts`, `scripts/test-auth-integration.mjs` | Covers config separation, backup corruption, provider failures, safe admin bootstrap, deletion confirmation, deactivation, session revocation and audit records |
| Admin bootstrap correction | `scripts/seed-admin.mjs` | Supports stdin passwords; emits SQL only; removes incorrect remote-development command |
| User-facing fixes | Admin login and student dialog components | Waits for form hydration; corrects error contrast and dialog focus |
| Email failure handling and incident correlation | `lib/email-transport.ts`, `lib/api.ts` | Sanitizes timeout/network/provider failures; supplies a matching incident ID for unexpected API failures |
| Operating procedures and policy drafts | [OPERATIONS-RUNBOOK.md](OPERATIONS-RUNBOOK.md), [POLICY-DRAFTS.md](POLICY-DRAFTS.md) | Gives owners concrete procedures and editable documents with unresolved decisions marked |

Commands and limitations: [LAUNCH-TOOLING.md](LAUNCH-TOOLING.md). Executed results: [VERIFICATION.md](VERIFICATION.md).

## Remaining launch work

These items are still incomplete or unverified. Tools being written does not mean the external operation has been performed.

1. **Accounts and infrastructure.** Create/authorize operator-owned Cloudflare and Resend accounts, enable MFA/recovery, decide hostnames, create separate staging/production Workers and D1 databases, and configure DNS/TLS. No real deployment config or remote deployment has been created here.
2. **Real email.** Verify the sending domain, add the Resend Worker secret, and test registration, verification, resend, reset, spam placement and failure handling with approved real mailboxes. Unit simulations do not prove delivery.
3. **Production access and institutions.** Create two individually assigned strong-password Super Admins, staff accounts with appropriate roles, approved colleges/domains, and an enrollment review process. Never reuse the earlier weak development password.
4. **Repository and pipeline activation.** Put this workspace under the intended Git repository, configure GitHub environments/branch protection and required checks, supply deployment variables/secrets, and run the hosted workflows. Written workflow files have not been executed on GitHub.
5. **Staging acceptance and capacity.** Deploy the exact reviewed build, run complete student/admin journeys, use real devices (including actual Safari/iPhone and Edge where supported), and measure authenticated messaging/chess/event workloads. The local built-preview POST/network issue remains a release verification concern; a passing development suite does not clear it. Validate on deployed staging and resolve failures before launch.
6. **Operational services and recovery.** Choose alert recipients and thresholds, connect monitoring/billing notifications, verify a delivered alert, select encrypted separate backup storage/retention, perform a remote D1 restore drill and measure recovery time. The supplied local restore test is not that drill.
7. **Operator decisions and approved policies.** Fill in legal identity, contacts, age/enrollment checks, retention/holds, support targets, appeal and incident ownership; obtain appropriate review. Publish approved terms/privacy/community/support information and update `/community` and registration links. The current public community page remains a preview notice; drafts have not been published as approved policies. Permanent purge automation must follow the approved retention and shared-record rules.
8. **Production release.** Apply the correct reviewed migration path, provision production secrets, record a backup/recovery point and compatible Worker version, deploy, pass production smoke tests, and have the release owner approve a gradual opening of registration with explicit stop conditions.

Most of items 1–6 and 8 can be executed with assistance once account access and operator values exist. Item 7 requires accountable human decisions; implementation can follow those decisions.

## Optional later work

- LiveKit voice transport, room/token permissions, provider webhooks and real audio/device tests.
- Private storage and validated image/file uploads, lifecycle cleanup and associated policy updates.
- Background push, opt-in subscriptions and delivery infrastructure.
- WebSockets if measured polling latency/cost requires them.
- Bounce-webhook automation; until implemented, the email owner must manage bounces/complaints through the provider dashboard.
- CAPTCHA, external moderation, analytics or a third-party error SDK if the chosen operating model needs them.
- Tournament/prize features, clocks, stronger engine hosting and anti-cheat controls.

These optional items are engineering projects and are not completed by adding credentials. Keep their unavailable UI/feature flags accurate during the pilot.
