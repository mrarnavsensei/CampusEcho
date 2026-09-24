# CampusCrate Echo operations runbook

Status: procedures prepared; operator details and real drills still required. Fill in the owner register and record actual evidence before opening registration.

## Owner register

| Responsibility | Named person and backup | Contact / escalation | Ready? |
| --- | --- | --- | --- |
| Deployment, Cloudflare, DNS and secrets | TO COMPLETE | TO COMPLETE | No |
| Database backup and restoration | TO COMPLETE | TO COMPLETE | No |
| Email delivery and sender reputation | TO COMPLETE | TO COMPLETE | No |
| Moderation and enrollment reviews | TO COMPLETE | TO COMPLETE | No |
| Support, appeals and grievances | TO COMPLETE | TO COMPLETE | No |
| Privacy, retention and lawful requests | TO COMPLETE | TO COMPLETE | No |
| Incident lead and launch approval | TO COMPLETE | TO COMPLETE | No |

Use separate accounts and MFA. Keep recovery codes in the operator password manager. Test recovery with the backup owner. Never copy credentials into this document or an incident ticket.

## Routine checks

Before launch, configure the destinations below and send a test alert to the responsible person. Proposed starting thresholds are operational suggestions to tune against measured pilot traffic, not capacity guarantees.

| Signal | Starting trigger | First response |
| --- | --- | --- |
| External `/api/health` plus real-page probe | Two failures one minute apart | Check provider incident status and Worker/D1 health |
| 5xx responses | More than 1% over five minutes with at least 100 requests, or repeated health failure at low traffic | Correlate release and incident IDs; inspect aggregate logs |
| Latency | p95 above two seconds for five minutes | Identify affected routes; inspect CPU and database usage |
| Email | Repeated provider rejection or missing verification/reset mail | Check Resend quota/domain/suppression status; suspend registration if onboarding is broken |
| D1, Worker and email usage | 70% and 90% of the operator's chosen budget/limit | Investigate growth, polling and misuse before increasing limits |
| Backup | No verified off-account copy inside the approved recovery window | Repair export/storage immediately and record the exposure |
| Reports and enrollment queue | Oldest item exceeds the approved response target | Escalate to the backup reviewer |

Daily during the pilot: review these signals, delivery failures, moderation queue, recent administrator changes and backup success. Weekly: review costs, role assignments, restore evidence and unresolved incidents. Restrict provider access logs: URLs and metadata can still identify users even when application error logs are redacted.

Unexpected API failures now return a random `incidentId` and `X-Incident-ID`. Match that ID to the structured `api_failure` log. The application intentionally does not log SQL arguments, error objects or private content. Provider-level logs require their own retention and access settings.

## Recovery drill

The technical owner must choose and document a recovery point objective (maximum data loss) and recovery time objective (maximum outage). No duration is assumed by the software.

1. Export the intended source with `npm run backup:export -- deployment.production.local.jsonc`; protect and copy the SQL plus manifest to separate storage.
2. Verify the checksum and isolated restore with `npm run backup:verify -- backups/FOLDER/database.sql`.
3. Create a new, empty D1 database dedicated to recovery rehearsal. Record its UUID and confirm it differs from both active databases.
4. Create a separate recovery configuration referring only to that database. Do not apply the baseline before importing a full export. Ensure the rehearsal Worker is access-restricted and does not send real email.
5. Authenticate to the correct account. Inspect the destination's table list before importing. Use the installed Wrangler's `d1 execute RECOVERY_DATABASE --remote --config RECOVERY_CONFIG --file TRUSTED_BACKUP.sql`. This is a remote write; the designated operator runs it after checking the exact destination.
6. Verify foreign keys, required tables, table counts, ownership, moderation/audit records and health. Use controlled accounts for app checks. Do not expose restored production data to ordinary test users.
7. Record export time, restore time, checksum, source/destination IDs, expected/observed counts, failures and actual recovery duration. Test what happens to sessions and email tokens after restoration; revoke or invalidate restored access when appropriate.
8. Keep the original source intact. Only switch a live binding after an incident lead approves the recovery point and reconciles newer writes and provider effects. Apply the retention policy to the rehearsal copy.

For an application-only regression, use a recorded compatible Worker version. A Worker rollback does not roll back D1. Avoid automatic rollback following a schema change. Preserve logs and release identifiers, verify recovery, and record what users need to retry.

## Incident response

1. Acknowledge the alert and name an incident lead. Record start time, impact, last healthy time, release version and incident IDs without private message content.
2. Contain the issue. Close registration if necessary; use maintenance mode for student access. Maintenance mode does not disable administrator APIs, so restrict operator access separately when required.
3. Preserve relevant evidence with controlled access. Rotate affected credentials and revoke sessions when compromised. Never paste secrets or exports into chat channels.
4. Choose forward fix, compatible Worker rollback, or recovery to a separate database. Record the decision and recovery point.
5. The privacy/legal owner determines notification obligations and contacts. This runbook does not establish a legal deadline.
6. Run health and critical login/social/admin checks, monitor stability, then reopen access gradually.
7. Record root cause, corrective actions, owners, deadlines and recovery measurements. Verify the actions before closing the incident.

## Moderation, support and deletion

Define staffed hours, urgent escalation, response targets and an appeal route. For a report: verify scope, restrict access to evidence, record the reason for any action, notify through the approved channel, and assign a different reviewer to an appeal when possible. Emergency services and institutional contacts must be chosen for the actual operating region.

For enrollment: document accepted evidence, reject unnecessary sensitive documents, distinguish college mailbox ownership from enrollment, record decisions, and define renewal/alumni handling. The current registration form requires the user to confirm age 18+; this is self-declaration, not age assurance.

For a deletion request: verify identity, locate the deactivated account, record the request time and applicable retention/hold decision, revoke access, and apply the approved removal policy across content, messages, moderation records, providers and backups. The current API immediately deactivates access and records a pending retention review. It does not perform an irreversible purge. An automatic purge cannot be correctly completed until retention, legal holds and shared-record handling are approved.

## Release record template

Copy this section into a private release record; do not place user data or secrets here.

- Release owner and backup:
- Reviewed commit/build ID and previous compatible Worker version:
- Staging hostname, Worker and D1 identifiers:
- Check/build/API/browser report and real-device versions/results:
- Real email registration/reset results and failure exercise:
- Pilot workload, concurrency, latency, CPU, D1 and email measurements:
- Migration path/ledger, operator and timestamp:
- Backup checksum, location, recovery bookmark and restore-drill result:
- Production hostname, Worker and D1 identifiers:
- Policy versions, support contacts and staffing approval:
- Go/no-go decision, rollout size and next review time:
- Stop conditions, rollback decision owner and response contact:
