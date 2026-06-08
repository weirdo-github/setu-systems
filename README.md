# Setu Systems

Setu Systems is the unified production codebase for the Setu portal family. It consolidates the former `setu-finance` and `setu-discover` applications into one deployable system with a shared brand, one Node/Next.js runtime, and one PostgreSQL data plane.

## Live Portal Routes

| Portal | Route | Purpose |
| --- | --- | --- |
| setu systems | `/` | Main product-family landing and portal selection. |
| setu finance | `/finance` | Finance operations, contract intake, customer records, invoices, receipts, payables, people, contracts, audit, and AskSetu. |
| setu referral | `/referral` | Public referral intake, referrer lookup, referral review, reward qualification, and finance approval. |
| setu discover | `/discover` | Opportunity inventory, source refresh, client matching, review queue, outreach logging, and media administration. |
| setu media | `/media` | Media writer workspace for article assignments, work logs, submissions, and delivery history. |

Legacy referral routes such as `/refer`, `/refer/:code`, `/r/:code`, and `/referral-gateway/:code` remain supported and canonicalize into the referral portal experience.

## Standardized Stack

- Next.js App Router for all browser portals and route-level UX.
- A unified Node/Express server entrypoint in `server/unified.js`.
- Finance API routes preserved through the Express app from `server/index.js`.
- Discover API routes mounted under `/api/discover/*` and internally handled by Next route handlers.
- Media writer API routes mounted under `/api/media/*` and handled by Next before Finance API routing.
- PostgreSQL as the shared system of record. Finance and Discover schemas live side-by-side in one database for local and cost-efficient AWS deployment.
- Local generated files use `server/storage`; production document storage is designed for private S3.

## Local Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create local environment:
   ```bash
   cp .env.example .env
   ```

3. Start local Postgres:
   ```bash
   npm run db:start
   ```

4. Build both schemas and seed data:
   ```bash
   npm run db:setup
   ```

5. Start the unified app:
   ```bash
   npm run dev
   ```

6. Open:
   ```text
   http://127.0.0.1:4173
   ```

## Useful Commands

| Command | Use |
| --- | --- |
| `npm run dev` | Run the unified local server. |
| `npm run build` | Build the production Next.js app. |
| `npm run start` | Run the production server entrypoint after build. |
| `npm run db:start` | Start the local PostgreSQL container. |
| `npm run db:setup` | Run Finance migrations, seed Finance, and set up Discover tables. |
| `npm run db:migrate` | Run Finance schema migrations only. |
| `npm run db:discover:setup` | Set up Discover schema and registry data only. |
| `npm run finance:sync` | Sync Discover client engagement flags from Finance. |
| `npm run phase2:run` | Run one Discover source ingestion pass. |
| `npm run lint` | Run Next/TypeScript lint checks. |

## Default Local Access

Finance uses:

- username: `admin`
- password: `PORTAL_PASSWORD` from `.env`

Discover uses:

- `admin@discover.local` / `discover123`
- `teammate@discover.local` / `discover123`

Media uses:

- `writer1@media.local` / `media123`
- `writer2@media.local` / `media123`

Change local credentials before any shared environment is exposed.

## Production Documentation

- [System architecture](docs/SETU_SYSTEMS_ARCHITECTURE.md)
- [AWS deployment guide](docs/AWS_DEPLOYMENT.md)
- [Operations runbook](docs/OPERATIONS_RUNBOOK.md)
- [Portal functional map](docs/PORTAL_FUNCTIONAL_MAP.md)
- [Data and security model](docs/DATA_AND_SECURITY.md)
- [Media portal handoff](docs/MEDIA_PORTAL.md)
- [Documentation and artifact index](docs/ARTIFACT_INDEX.md)

The inherited Finance and Discover product documents remain in `docs/` and `docs/discover/` for traceability, but the files above are the controlling Setu Systems handoff documents.
