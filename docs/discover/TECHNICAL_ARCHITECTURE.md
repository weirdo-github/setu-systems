# setu discovery Technical Architecture

## Stack

- Next.js app router
- React client components
- PostgreSQL 16
- `pg` for database access
- Nodemailer for SMTP email
- OpenAI Responses API optional for structured extraction
- Local deterministic semantic scoring for Match & Send
- Docker Compose for local app/database hosting

## Local Services

Default local PostgreSQL:

```text
postgres://discover:discover@localhost:5435/discover
```

Default app URL:

```text
http://127.0.0.1:4173/discover
```

## Database Spine

The stable record spine is `events`.

Core tables:

- `users`
- `sessions`
- `sources`
- `source_pages`
- `denylisted_domains`
- `events`
  - System-of-record opportunity inventory.
  - `created_at` is surfaced as the Inventory added date.
- `clients`
  - Stores profile fields plus Finance-owned `engagement_status` and `engagement_as_of`.
- `recommendations`
- `applications`
- `email_logs`
- `ingestion_runs`
- `ingestion_items`
- `review_items`
- `integration_sync_log`
  - Stores Finance sync received, matched, error, and run timestamp metadata.

## Finance Engagement Integration

Discover consumes:

```text
GET ${FINANCE_BASE_URL}/api/integration/engagement-status
Header: X-Api-Key: ${FINANCE_INTEGRATION_KEY}
```

Consumer script:

```text
scripts/syncFinanceStatus.js
```

Manual command:

```bash
npm run finance:sync
```

The sync updates matching `clients` rows by normalized email and optional Finance aliases. It writes only `engagement_status` and `engagement_as_of`. Unmatched clients keep the default `unknown` status.

Optional webhook:

```text
POST /api/webhooks/finance/engagement
Header: X-Signature: sha256=<hmac>
```

The webhook verifies HMAC-SHA256 with `WEBHOOK_SECRET` over the raw request body and applies the same single-customer status update as the full sync.

Push eligibility is centralized in:

```text
src/lib/engagement.ts
```

The guard requires `engagement_status = active` and a non-stale `engagement_as_of` timestamp. The stale threshold is 24 hours.

## Phase 2 Pipeline

Main module:

```text
src/lib/phase2-ingestion.ts
```

Master registry data:

```text
data/source-registry.json
```

The JSON registry is normalized from the EB-1A workbook and imported by `scripts/setup-db.mjs`. It stores source organization, source category, EB-1A criteria tags, typical fee, canonical domain, seed URL, credibility tier, and workbook rank.

Primary functions:

- `registryPages()`
- `guardedFetch()`
- `cleanHtml()`
- `ruleBasedExtract()`
- `extractOpportunities()`
- `validateClientOpportunity()`
- `runPhase2Ingestion()`

`validateClientOpportunity()` is the final persistence gate. A candidate must have a title, summary, public source URL, public apply/client URL, canonical-domain alignment, an application/nomination/submission-style action signal, and a reachable final link. Failed candidates are not written to active inventory.

Run endpoint:

```text
POST /api/ingestion/run
```

Local script:

```bash
npm run phase2:run
```

## Paused Agent Runner

The Discovery agent runner is intentionally not shipped in the current product. The codebase has no LangGraph dependency, no `src/lib/phase3-agent.ts`, no `POST /api/agent/run` route, and no `phase3:run` npm script. Daily Refresh remains the supported automated source ingestion path.

## Removed Intelligence Surface

The current product does not ship the Intelligence section. The codebase has no `src/lib/phase4-intelligence.ts`, no `data/curator-candidates.json`, no `GET /api/phase4` route, and no evidence export routes. Hybrid semantic scoring remains in Match & Send through `src/lib/matching.ts`.

## Hybrid Matching

Main module:

```text
src/lib/matching.ts
```

The score combines:

- criteria gap fit
- credibility tier
- exact keyword fit
- semantic text similarity
- actionability
- location fit
- preferred category boost

Semantic similarity is local and deterministic. It uses normalized text terms plus a small domain alias map so it can run without Qdrant or an external embedding service. The implementation is intentionally swappable: a future Qdrant-backed vector score can replace the local semantic component while keeping the `MatchBreakdown.semantic` contract.

## Human Review Rejoin Flow

Review endpoint:

```text
PUT /api/review-items/[id]
```

Supported statuses:

- `approved`: upserts a reviewed opportunity payload into `events`.
- `rejected`: closes item and archives linked event if one exists.
- `open`: reopens item.

## Environment Variables

Required:

```text
DATABASE_URL
SESSION_SECRET
PHASE2_RUN_TOKEN
DISCOVER_URL
FINANCE_BASE_URL
FINANCE_INTEGRATION_KEY
```

Optional:

```text
OPENAI_API_KEY
OPENAI_EXTRACTION_MODEL
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASS
SMTP_FROM
WEBHOOK_SECRET
```

## Verification Commands

```bash
npm run db:setup
npm run lint
npm run build
npm run phase2:run
```

## Git Hygiene

Do not commit:

- `.env`
- `.env.local`
- `.next`
- `node_modules`
- runtime screenshots
- local database volumes

The committed `.env.example` contains placeholders only.
