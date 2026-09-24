# Architecture and trust boundaries

## Runtime and data

One Cloudflare Worker serves the React/Vinext app, admin pages and same-origin APIs. D1 is the system of record. Drizzle supplies typed queries; prepared SQL handles atomic conditional operations and reporting. No additional database or realtime vendor is needed for the current text-first pilot.

Student screens fetch real APIs through `lib/client-api.ts` and `hooks/use-resource.ts`. Lists use bounded pagination. Messages poll every five seconds while visible; the inbox polls every eight. Active chess games poll approximately every 2.5 seconds. These are polling implementations, not WebSocket transports.

## Identity and authorization

Student identity comes from an opaque HttpOnly SameSite=Strict session cookie whose SHA-256 digest is stored. Passwords use salted PBKDF2-SHA-256 with 600,000 iterations. Email tokens are random, hashed, expiring, purpose-specific and consumed transactionally. Reset revokes prior sessions.

Production does not grant access from hosting identity headers. Explicit development sign-in requires development configuration and loopback access. Invalid/revoked cookies do not fall back to that identity. Protected operations resolve current account/college state and email verification; manual enrollment policy additionally requires an approved review. Mailbox verification does not prove enrollment or age.

Admin accounts, sessions and cookies are separate. Every API and the protected server layout enforce roles. Student roles cannot authenticate administrators. Sensitive mutations and their audit record commit together. Database triggers protect the last active Super Admin.

## Privacy and content

New anonymous posts/comments get independent random aliases. APIs strip author IDs and emails. Legacy deterministic aliases are replaced by a generic label. Authorship remains in the database for enforcement; operator database access must be restricted. Routine admin screens withhold private-message bodies and anonymous-author mappings. Exceptional disclosure needs a separately approved operational process.

Feed visibility uses the authenticated campus, current account status, privacy and reciprocal blocks. Identified private posts require an existing follow. Anonymous posts are excluded from another student's profile/following feed. Message queries require membership and eligible same-campus participants. Client-supplied IDs do not establish authorization.

Basic local content rules always run. A configured moderation endpoint can require review; transport/malformed-provider responses fail closed. Pending posts are acknowledged accordingly. Comment/profile/message rejection is shown as an error. A student edit cannot restore admin-removed content.

## Integrity and browser security

Unique keys enforce likes, votes and relationships. Deterministic pair IDs deduplicate conversations, and message retry IDs deduplicate sends. Event capacity uses conditional inserts. Chess persists PGN/state with a compare-and-swap version; chess.js validates moves server-side. Clients cannot submit authoritative results. Community points exclude AI, short/flagged games and repeated opponent pairs per day; they do not guarantee anti-collusion.

Mutations check origin and bounded JSON objects. Database-backed rate limits work across isolates. Queries bind parameters. React renders text; arbitrary HTML/upload URLs are not accepted. Per-request CSP nonces authorize framework startup scripts. PWA caching contains public offline assets only, never personalized HTML or API responses.

## Schema and operations

Local migrations 0005–0008 add student credentials/tokens/reviews/rate limits, aliases/read boundaries/indexes, admin constraints and authoritative chess state. The separate fresh production baseline has no local identities and starts with registration closed. Populated legacy 0000 data requires a rehearsed conversion; see DEPLOYMENT.md.

Handwritten migrations are authoritative. Drizzle's historical snapshots predate these additions. Do not blindly run db:generate or schema push against production; reconcile snapshots in an isolated scratch database before adopting generated migrations.

The health route probes required database tables and returns 503 when unavailable. Unexpected application failures use generic incident IDs, and email/provider errors are sanitized; observability is enabled in the deployment template. Provider-log access/redaction and retention, alert routing, third-party error monitoring and restore drills still need operator configuration. Account deletion deactivates/hides data, revokes sessions and records a request; permanent purge and retention remain operator procedures.
