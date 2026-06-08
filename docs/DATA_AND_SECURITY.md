# Data And Security Model

## Data Boundary

Finance is the source of truth for customer finance data, invoices, payments, balances, contracts, receipts, people, payables, and audit events.

Discover is the source of truth for opportunities, sources, review items, matches, email logs, ingestion runs, Discover client records, and Media assignments.

Media is a dedicated writer surface over the Discover data plane. It stores writer identities, assignment lifecycle records, assignment events, and writer work logs in `media_*` tables.

Referral uses Finance APIs and data structures because rewards, relationships, and discount qualification are finance-controlled workflows.

## Shared Database

Setu Systems uses one PostgreSQL database for cost-effective production startup. The application keeps logical boundaries in code:

- Finance reads and writes through `server/stateStore.js` and Finance DB modules.
- Discover reads and writes through `src/lib/repository.ts` and Discover route handlers.
- Media reads and writes through `src/lib/mediaRepository.ts`, `src/lib/mediaAuth.ts`, and Next route handlers under `src/app/api/media`.
- Cross-portal status sharing uses the Finance provider endpoint, not direct cross-schema reads.

## Privacy Rules

- Discover must not store or display Finance payment amounts, invoice amounts, balances, memos, or raw transaction detail.
- Media must not store or display Finance payment amounts, invoice amounts, balances, memos, or raw transaction detail.
- Media writer views are limited to client display name, article title, EB-1A criterion, brief, due date, status, and the writer's own work log.
- Discover admins record publisher names and live publication links; writers cannot set publication links.
- Auth audit logs must not store passwords, API-key values, tokens, session cookies, MFA codes, raw IP addresses, or raw user-agent strings.
- Provider integrations use status-only payloads.
- Production files should be private-by-default and served through controlled download routes.

## Authentication

Finance, Discover, and Media currently use separate portal auth surfaces. Media uses its own `media_users` and `media_sessions` tables so a writer session cannot become a Discover admin session. Production hardening should move all portals behind one identity provider when external clients use the system:

- Cognito, Auth0, or another OIDC provider.
- Role-based access by portal and action.
- MFA for administrators.
- Session rotation and short idle timeouts.

## Secrets

Use Secrets Manager or SSM Parameter Store for:

- `DATABASE_URL`
- Portal passwords and session secrets.
- Integration API keys.
- SMTP credentials.
- Gmail OAuth credentials.
- OpenAI API key.
- S3 bucket configuration where sensitive.

## Audit

Finance auth audit events already store safe event metadata. Production expansion should add:

- Discover auth audit events.
- Media auth and media assignment lifecycle events.
- Admin action audit trails for source approvals and email pushes.
- Admin action audit trails for media assignment edits, reassignment, publication, close, incomplete-close, and reopen.
- Deployment/migration history.
- Alerting on repeated auth failures and provider-key failures.
