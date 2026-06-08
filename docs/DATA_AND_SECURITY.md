# Data And Security Model

## Data Boundary

Finance is the source of truth for customer finance data, invoices, payments, balances, contracts, receipts, people, payables, and audit events.

Discovery is the source of truth for opportunities, sources, review items, matches, email logs, ingestion runs, and discovery client records.

Referral uses Finance APIs and data structures because rewards, relationships, and discount qualification are finance-controlled workflows.

## Shared Database

Setu Systems uses one PostgreSQL database for cost-effective production startup. The application keeps logical boundaries in code:

- Finance reads and writes through `server/stateStore.js` and Finance DB modules.
- Discover reads and writes through `src/lib/repository.ts` and Discover route handlers.
- Cross-portal status sharing uses the Finance provider endpoint, not direct cross-schema reads.

## Privacy Rules

- Discover must not store or display Finance payment amounts, invoice amounts, balances, memos, or raw transaction detail.
- Auth audit logs must not store passwords, API-key values, tokens, session cookies, MFA codes, raw IP addresses, or raw user-agent strings.
- Provider integrations use status-only payloads.
- Production files should be private-by-default and served through controlled download routes.

## Authentication

Finance and Discover currently use separate portal auth surfaces inherited from the source applications. Production hardening should move both behind one identity provider when external clients use the system:

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
- Admin action audit trails for source approvals and email pushes.
- Deployment/migration history.
- Alerting on repeated auth failures and provider-key failures.
