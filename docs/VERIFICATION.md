# Verification record — 24 September 2026

These results are local execution evidence. They do not establish production capacity, real email delivery, real-device/visual acceptance or legal compliance. The original audit is in IMPLEMENTATION-AUDIT.md; final architecture and external requirements are separate documents.

## Executed checks

| Check | Observed result | Coverage / limits |
| --- | --- | --- |
| `npm run typecheck` | Passed | TypeScript across the current app and API code. |
| `npm test` | 27 passed, 0 failed | Password/token crypto, schema/last-admin integrity, chess rules/concurrency/standings, launch tooling/failure handling, fixture-adapter safety guard, fresh production baseline and legacy product helpers. The old alias/Elo helper tests do not describe current public aliases or community points. |
| `npm run lint` | Passed | No errors or warnings in the final lint run. Existing vendored/admin rule exceptions remain visible in eslint.config.mjs. |
| `npm run build` | Passed | Production Worker and client assets generated. Framework emits plugin timing notices and cannot statically classify some dynamic admin routes; authorization is tested separately. |
| Social HTTP suite | 77 assertions passed | Persistence, anonymous identity stripping, campus/ownership boundaries, moderation, likes/votes/saves/comments, privacy/follows/blocks, notifications, DM membership/retries/read boundaries, selected-conversation lookup authorization, pagination and concurrent event capacity. |
| Student auth/account HTTP suite | 53 assertions passed | Actual password login, account/session restrictions, cookies, logout/current-other sessions, token expiry/purpose, simultaneous one-use verification/reset, replay, input/origin guards, and deletion-request confirmation/deactivation/session revocation/audit. Email tokens are seeded fixtures; no provider mail was sent. |
| Admin HTTP suite | 27 assertions passed | Server redirects, role checks, pagination, PII masking, anonymous/private-message protection, CSRF, reasons, real remove/restore/assignment/verification/suspension, last-admin protection, login and audit. Injected audit failure proved mutation rollback. |
| Chess HTTP suite | 42 assertions passed | Legal/illegal moves, turn/campus/membership checks, concurrent join, replay/version protection, persistence/reconnect, resignation/draw, result integrity, AI and standings. |
| HTTP/HTML security smoke | 12 passed on development; 12 passed on an earlier production preview | Fresh per-request CSP nonces, matching inline script attributes, no unsafe-inline scripts, no-store HTML, security headers, database readiness, admin redirect, anonymous API rejection and offline asset. This is not browser execution. |
| Playwright browser/accessibility matrix | 16 passed, 0 failed | API/security dependency plus three interaction journeys on desktop Chromium, Firefox and WebKit and 360/390px mobile Chromium/WebKit emulation. Includes hydration, auth/admin feedback, persisted posting, reload, navigation, profile/logout, dialog focus/Escape, horizontal overflow and automated WCAG A/AA checks. Emulation is not a real Safari/iPhone or visual sign-off. |
| Wrangler deployment dry run | Passed | Generated Worker/assets accepted for packaging; no upload/deployment. |
| Deployment placeholder preflight | Rejected as expected | The example config lacks a real database UUID; public deployment remains intentionally unconfigured. |

## Development startup resolution

`proxy.ts` now returns the standard middleware response/header protocol directly instead of loading the `next/server` compatibility module during Worker export discovery. Fresh starts with this version have reached a healthy local server and passed all 12 HTTP/HTML checks. The earlier import-based version failed at `getWorkerEntryExportTypes`. During final verification, starts inside the restricted Windows process sandbox again failed at that upstream export-discovery boundary; the same checked-out code started normally with standard child-process permissions, reached `/api/health`, and completed the entire browser matrix. Cold startup took approximately 47–90 seconds on this machine, so a short connection-refused poll is not by itself a startup failure. No dependency downgrade or security-header removal was used.

The installed Wrangler 4.92 local production-preview proxy produced repeat POST 503s after early-rejected request bodies, with a “worker restarted” message. Individual curl requests sometimes succeeded, but `Connection: close` did **not** fix the full sequence. An isolated Wrangler 4.114 diagnostic exposed `Network connection lost`, then the preview process exited. No dependency upgrade was retained. Similar unconsumed-body/proxy failures are reported in [workers-sdk #15203](https://github.com/cloudflare/workers-sdk/issues/15203) and [#15709](https://github.com/cloudflare/workers-sdk/issues/15709); this similarity is not proof of the exact upstream cause. **The full built-preview API suite did not pass.** Do not equate this local failure with a deployed production outage; actual staging acceptance remains required.

Final development rerun: **199 API assertions passed** (53 authentication/account + 77 social + 27 admin + 42 chess), all 12 HTTP/HTML checks passed, and all 16 Playwright projects/tests passed. The successful run used the optional `TEST_DB_BACKEND=sqlite` fixture adapter, which opens only the single existing workspace-local database and sets up/cleans fixtures transactionally without spawning another Worker. Every application request still ran through HTTP and the real D1 binding. No assertion was skipped or retried to hide an error. A final read-only query found no remaining auth/social/admin/chess/browser test campuses.

The newer-Wrangler diagnostic had a local side effect: its runtime updated D1/cache alarm metadata, after which the pinned runtime and default fixture CLI aborted with `std::terminate`. An isolated Worker with an ephemeral database worked; the same Worker with the existing persistence path failed. Both `metadata.sqlite` files had zero scheduled alarms. With all Workers stopped, those two metadata files were moved to ignored, recoverable backups (`.sites-runtime/runtime-metadata-4.114-backup.sqlite` and `.sites-runtime/runtime-cache-metadata-4.114-backup.sqlite`) and recreated by the pinned runtime. The application SQLite database was not reset, moved or migrated. The pinned D1 CLI and compiled Worker health probe then passed. Low available memory was observed but did not explain this persistence-specific failure. Future tool-version experiments must use a separate copy of local runtime state, not the application's persistence directory. The final QA server was stopped after the successful matrix.

API suites created randomly named local fixtures and removed them in `finally`; existing user/admin records were preserved. Some security limiter entries expire naturally. The helper refuses remote targets before creating fixtures. The admin suite intentionally simulates an audit failure. Do not run integration suites while rebuilding the framework output: a restart may interrupt an HTTP request.

## Checks not executed / launch dependencies

- **Real-device and visual acceptance:** automated browser hydration, keyboard focus, accessibility and responsive-width checks passed in Playwright. Actual Safari/iPhone, Edge, assistive-technology and human visual review have not been recorded; emulation cannot replace them.
- **Real registration/email:** Resend credentials, a verified sender, an HTTPS APP_URL and approved college mailbox are missing. Token lifecycle tests do not prove deliverability. Run registration, resend, reset and provider-failure tests in staging.
- **Live voice:** no audio transport is configured or integrated. No microphone, TURN, reconnection, host removal or live audio test passed. The UI labels this unavailable; EXTERNAL-SETUP.md has the integration plan.
- **Production/load:** no remote database migration, DNS change, deployment, restore drill, capacity measurement or production monitor has been executed.
- **Operations/legal:** policies, support/grievance contacts, enrollment criteria, appeals, retention/purge, lawful requests and incident response need the operator's decisions and review.

## Remaining staging and real-device acceptance

1. On named real devices at 360/390px mobile and 1280/1440px desktop, repeat navigation, overflow, focus visibility, labels, dialog focus/Escape and keyboard controls; include actual Safari/iPhone and Edge.
2. Create an anonymous and identified post, vote, like/unlike, bookmark, comment/edit/delete and reload. Open a copied post link. Trigger a pending moderation decision and confirm its acknowledgement.
3. Edit profile, follow/unfollow and block another test account. Confirm private/blocked content cannot be viewed through a shared URL. Check empty/error/retry states, offline navigation and sign-out without cached personal data.
4. Use two accounts to send messages, retry a failed send, paginate older history and confirm read status. Test a failed new conversation, block restrictions and a narrow-screen back action.
5. Play AI and two-user multiplayer chess; reload during a game, reject an out-of-turn move, offer/accept a draw and resign. Confirm point eligibility and that AI practice is unranked.
6. As separate admin roles, open only allowed pages, moderate a report, review enrollment, restrict/reinstate an account, create/publish an event and review actual registrations/audits.
7. Use real staging mailboxes for registration/verification/recovery. Exercise expired/reused links and provider outage. Review network and console output for private data, unexpected CSP failures and uncaught errors.

Record actual device/browser versions and results; do not mark these steps complete merely because the underlying API tests passed.
