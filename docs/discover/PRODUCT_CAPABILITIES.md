# setu discovery Product Capabilities

## What The Product Can Do Now

setu discovery is a local-first operating system for finding, qualifying, matching, and sending EB-1A profile-building opportunities.

## Core Operating Capabilities

- Maintain a PostgreSQL-backed opportunity inventory.
- Filter inventory by EB-1A opportunity category.
- Show the date each opportunity was added to inventory for quick freshness review.
- Maintain client profiles with target criteria, covered criteria, keywords, preferred categories, field, and location.
- Store each client's Finance-owned engagement flag as active, dormant, inactive, or unknown.
- Track source registry records from the EB-1A master source list.
- Add canonical sources with predefined registry categories and multiple applicability tags.
- Monitor source pages with fetched and changed timestamps.
- Run guarded ingestion against canonical source domains.
- Route uncertain, low-confidence, or policy-flagged records to review.
- Approve or reject review items before records become client-facing.
- Send or locally simulate recommendation emails.
- Log email attempts against clients and opportunities.
- Block opportunity pushes unless the client is Finance-active with fresh status.
- Search clients inside Match & Send before reviewing AI-ranked or manually selected opportunities.
- Search active opportunities in Match & Send and manually push a chosen opportunity through the same gated email workflow.
- Archive stale or unsuitable opportunities.

## Matching Capabilities

- Hybrid matching combines:
  - criteria gap fit
  - credibility tier
  - exact keyword fit
  - semantic text similarity
  - actionability
  - location fit
- Match recommendations are hidden when the client is dormant, inactive, unknown, or stale.
- Admins can manually search opportunities and send a selected opportunity through the same Finance-gated email workflow.

## Source And Opportunity Policy

- The EB-1A workbook is normalized into `data/source-registry.json`.
- `npm run db:setup` imports 45 canonical sources.
- The setup creates standing opportunities only for selected registry rows that are already client-action paths.
- Old local fixture opportunities are archived and are not active.
- Ingestion does not save broad source pages as active opportunities.
- A refreshed opportunity must have a public source/apply link on the canonical source domain before it can become active inventory.

## What AI Does

- OpenAI extraction is optional for changed source content.
- Match & Send uses local deterministic semantic scoring, not external embeddings by default.
- AI does not automatically send emails, approve sources, approve review items, or bypass domain guardrails.
- AI and matching cannot bypass the Finance engagement gate.

## Finance Engagement Gate

- Discover reads `GET /api/integration/engagement-status` from Finance using `X-Api-Key`.
- Discover stores only `engagement_status` and `engagement_as_of`.
- Discover never connects to the Finance database.
- Discover does not expose amounts, invoices, balances, payments, or thresholds.
- Admin screens show only the engagement badge.
- `unknown` is the default and is not pushable.

## What Humans Control

- Trusted source registry.
- Source credibility and refresh status.
- Review queue approvals and rejections.
- Client communication.

## Paused Capability

- The Discovery agent runner is removed from the current product.
- There is no Run Agent button, agent tab, `/api/agent/run` endpoint, `phase3:run` script, or LangGraph dependency.
- Daily Refresh remains the supported automated source refresh path.
- The Intelligence section is removed from the current product.
- There is no Intelligence tab, `/api/phase4` endpoint, evidence export endpoint, curator proposal workspace, or client portal preview.

## Local Review Entry Points

- App: `http://127.0.0.1:4173/discover`
- Admin: `admin@discover.local`
- Password: `discover123`
- GitHub: `https://github.com/dlk710/setu-discover`
