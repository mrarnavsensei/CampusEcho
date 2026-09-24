# Operator policy drafts for review

Status: drafting complete, not approved for publication. Replace every `TO COMPLETE`, confirm the statements against the intended launch, and obtain the operator's review before linking these documents from registration. This file supplies editable wording; it does not establish legal compliance.

Development may continue with every `TO COMPLETE` entry unresolved. These entries are configuration placeholders, not permission to invent operator details. Runtime-facing values use the `POLICY_*` deployment variables documented below. Staging reports unresolved values; production preflight requires an approved status and complete values.

## Runtime configuration mapping

| Policy input | Deployment variable |
| --- | --- |
| Approval state | `POLICY_STATUS` (`draft` or `approved`) |
| Legal operator | `POLICY_OPERATOR_NAME` |
| Support, privacy and grievance contacts | `POLICY_SUPPORT_CONTACT`, `POLICY_PRIVACY_CONTACT`, `POLICY_GRIEVANCE_CONTACT` |
| Urgent safety and appeal contacts | `POLICY_URGENT_SAFETY_CONTACT`, `POLICY_APPEAL_CONTACT` |
| Support response target | `POLICY_SUPPORT_RESPONSE_TARGET` |
| Effective date, version and regions | `POLICY_EFFECTIVE_DATE`, `POLICY_VERSION`, `POLICY_LAUNCH_REGIONS` |
| Minimum registration age | `POLICY_MINIMUM_AGE` |
| Enrollment criteria | `POLICY_ENROLLMENT_CRITERIA` |
| Providers and processing summary | `POLICY_PROVIDER_SUMMARY` |
| Retention and deletion summary | `POLICY_RETENTION_SUMMARY` |

Set deployment values through `DEPLOY_POLICY_*` environment variables when generating a configuration. For example, `POLICY_OPERATOR_NAME` is supplied as `DEPLOY_POLICY_OPERATOR_NAME`. Keep `POLICY_STATUS=draft` until the operator has approved all values. Credentials and private operational data do not belong in these variables.

## Decisions required before publication

| Decision | Operator input |
| --- | --- |
| Legal operator, address and launch regions | TO COMPLETE |
| Privacy/support/grievance contacts and response targets | TO COMPLETE |
| Approved institutions and enrollment criteria | TO COMPLETE |
| Age verification process for the current 18+ registration rule | TO COMPLETE |
| Provider contracts, processing locations and retention | TO COMPLETE |
| Retention periods, legal holds and deletion method | TO COMPLETE |
| Policy effective date, version and approval record | TO COMPLETE |

## Privacy notice draft

CampusCrate Echo is operated by **TO COMPLETE**. Contact **TO COMPLETE** for privacy questions and requests. This notice takes effect on **TO COMPLETE** and applies to **TO COMPLETE launch regions**.

We process college email addresses, profile details, account and session records, posts, comments, poll votes, follows and blocks, messages, reports, event registrations and casual chess records to provide the service. We also process limited security, delivery and administrator audit information. Explain the approved purposes and applicable basis for each activity here: **TO COMPLETE**.

Anonymous posts hide your profile from ordinary viewers. The service retains authorship records for operation and safety; anonymity is not a promise that the operator cannot identify the account. Identified posts and profiles follow the application's campus and privacy restrictions. Messages are stored by the service and are not end-to-end encrypted. Routine administrator screens do not expose message bodies or anonymous-author mappings.

The intended hosting/database provider is Cloudflare and the intended account-email provider is Resend. Confirm the actual providers, processing locations, contracts and any additional recipients before publication: **TO COMPLETE**. Voice, file uploads and background push are unavailable in the initial pilot. Do not describe them as collecting data until their implementation and notice are reviewed.

Authentication uses essential session cookies. Explain any additional analytics or tracking actually enabled: **TO COMPLETE**. The current application does not require marketing analytics to function.

You can change profile information, manage sessions, block/report accounts and request deletion from your profile. Deletion requests immediately deactivate access; retained records and backups require a separate removal process. Specify retention by category, legal-hold handling, request verification, expected response time and backup expiry here: **TO COMPLETE**. Contact **TO COMPLETE** for other requests and appeals.

Registration currently asks users to confirm that they are 18 or older and belong to an approved college. Mailbox verification does not establish age or enrollment. Describe the operator's approved checks, ineligible-user process and support channel: **TO COMPLETE**.

Describe how policy changes are communicated and when renewed acknowledgment is required: **TO COMPLETE**.

## Terms of service draft

The service is provided by **TO COMPLETE** for eligible adults at approved institutions, subject to the published enrollment criteria. Keep your credentials private, provide accurate account information, and notify **TO COMPLETE** of suspected compromise.

You retain your rights in your content. Specify the limited permission needed to host, display and process content for the service and the effect of deletion: **TO COMPLETE for review**. Do not upload material you are not entitled to share.

You must follow the community guidelines. The operator may review reports and restrict content or accounts using the published moderation process. Explain notice, reasons, urgent actions, appeals and account termination: **TO COMPLETE**.

Availability may be interrupted for maintenance or incidents. The initial chess feature is casual play and does not promise tournament adjudication, anti-cheat certification, prizes or paid competition. Voice, uploads and push are not offered in this pilot.

Explain any fees, institutional arrangements, service changes, disputes, applicable jurisdiction and legally reviewed limitations here: **TO COMPLETE**. Do not publish generic liability waivers without review for the actual operator and users.

## Community guidelines draft

- Treat others respectfully. Do not threaten, harass, discriminate, impersonate or organize targeted abuse.
- Do not publish another person's private information or share unlawful or exploitative material.
- Do not spam, manipulate votes, evade restrictions or misuse accounts and automation.
- Use the correct posting identity. Anonymous posting does not remove responsibility for content.
- Respect private conversations and institutional boundaries. Use blocking and reporting when needed.
- Report concerns through the app. For an immediate physical emergency, contact the relevant emergency service or institution; this app is not an emergency response service.

Reports are reviewed by authorized staff. Actions should be proportionate and documented. Publish staffed hours, urgent escalation, response targets, how decisions are communicated and the appeal channel: **TO COMPLETE**.

## Retention and deletion schedule draft

Do not substitute guessed durations. Agree on durations, purposes, legal holds and accountable owners before automating permanent removal.

| Record class | Trigger | Duration and reason | Removal method / owner |
| --- | --- | --- | --- |
| Account/profile and credentials | Approved deletion or account closure | TO COMPLETE | TO COMPLETE |
| Posts, comments, votes and social relations | Removal/deletion request | TO COMPLETE | TO COMPLETE |
| Shared messages and receipts | User request / conversation lifecycle | TO COMPLETE, including other participants | TO COMPLETE |
| Sessions, reset/verification tokens and rate-limit records | Expiration/revocation | TO COMPLETE | TO COMPLETE |
| Enrollment evidence | Verification decision/expiry | TO COMPLETE | TO COMPLETE |
| Reports, moderation and administrator audits | Case closure / hold release | TO COMPLETE | TO COMPLETE |
| Events and chess records | Event/game completion | TO COMPLETE | TO COMPLETE |
| Provider logs and delivery metadata | Creation / delivery outcome | TO COMPLETE | TO COMPLETE |
| Exports and recovery copies | Export date / rotation | TO COMPLETE | TO COMPLETE |

Track deletion requests with receipt time, identity check, scope, holds, approval, execution evidence, backup expiry and response date. Restored backups must not silently reactivate deleted accounts; reconcile pending deletions during every restoration.

## Support and grievance notice draft

Operator: **TO COMPLETE**. Support: **TO COMPLETE**. Privacy/grievance contact: **TO COMPLETE**. Hours and expected response time: **TO COMPLETE**. Urgent safety escalation: **TO COMPLETE**. Appeal channel and reviewer: **TO COMPLETE**.

When contacting support, provide the minimum information needed, such as an incident ID and approximate time. Never send passwords, session cookies or full reset links. Explain the identity-check process and how users can escalate an unanswered request: **TO COMPLETE**.
