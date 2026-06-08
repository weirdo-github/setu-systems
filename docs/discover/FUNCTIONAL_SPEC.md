# setu discovery Functional Specification

## Purpose

setu discovery helps the SETU Discover team find, qualify, match, review, and send profile-building opportunities for clients. The product is local-first, PostgreSQL-backed, and organized around one durable inventory spine: the `events` table.

## Users

- Admin: manages source registry, inventory, clients, ingestion, review queue, and outbound emails.
- Team member: reviews opportunities, matches clients, composes email outreach, and monitors runs.
- Client: not a separate portal user in the current product.

## Phase Coverage

### Phase 1: Manual Operating System

Phase 1 gives the team a working local portal:

- Login for admin/team users.
- Inventory CRUD for opportunities.
- Inventory list visibility for the date an opportunity was added.
- Inventory filtering by EB-1A opportunity category.
- Client profile CRUD.
- Client engagement badge sourced from Setu Finance.
- Customer status legend that explains Finance-side meaning and Discover-side push behavior.
- Deterministic status from deadline and archive state.
- Transparent matching score by criteria gap, credibility, keyword fit, actionability, and location.
- Match & Send includes manual active-inventory search so admins can push a specific opportunity even when they do not want to use the ranked queue.
- Match & Send includes client search by name, email, field, location, or keyword.
- Email compose/send flow with local logging fallback when SMTP is absent.
- Email and recommendation pushes fail closed unless the selected client is Finance-active with a fresh engagement timestamp.
- PostgreSQL persistence.

### Phase 2: Automated Ingestion

Phase 2 adds deterministic source ingestion:

- Admin-managed source registry with canonical domain, credibility tier, seed URL, status, refresh flag, and notes.
- Canonical source creation uses predefined registry categories and multi-select EB-1A applicability tags.
- Workbook-backed EB-1A master registry with organization, registry category, criteria tags, typical fee, and source rank.
- Source page monitor with fetched/changed timestamps.
- Domain-guarded fetch against allowlisted canonical domains.
- Content hash change detection.
- Structured opportunity extraction.
- Client-link verification that requires a public, reachable source/apply URL on the registry source domain before an extracted record can become active inventory.
- Run reports with pages checked, changed pages, upserts, expired purges, and review counts.
- Low-confidence review queue.
- Local scheduled run support.

### Paused: Discovery Agent

The Discovery agent runner is not part of the current product. The app does not expose a Run Agent button, agent tab, agent endpoint, or LangGraph runtime dependency. Source discovery currently runs through the Daily Refresh ingestion workflow and human review queue.

### Removed: Intelligence Workspace

The Intelligence section is not part of the current product. The portal does not expose an Intelligence tab, client portal preview, curator proposal workspace, evidence export endpoint, or Phase 4 API. Hybrid semantic scoring remains inside Match & Send.

## Key Workflows

### Manual Opportunity Entry

1. Admin opens Inventory.
2. Admin filters by EB-1A category or searches the full inventory.
3. Admin scans title, category, fee, credibility, status, added date, deadline, source, and actions.
4. Admin creates or edits an opportunity.
5. Required data includes title, category, credibility, summary, and actionability.
6. Optional data includes fee, source/apply links, criteria tags, keywords, field, and location.
7. Saved opportunity becomes eligible for matching.

### Client Matching

1. Admin opens Match.
2. Admin searches for and selects a client.
3. System checks the client's Finance engagement status.
4. Dormant, inactive, unknown, or stale clients receive no new opportunity list.
5. Active clients receive ranked active opportunities using hybrid deterministic scoring.
6. Admin can also search active inventory manually for a specific opportunity.
7. Admin reviews score evidence and sends email.
8. Email is logged whether SMTP sends it or local fallback simulates it.

### Finance Engagement Sync

1. Scheduler or operator runs `npm run finance:sync`.
2. Discover calls Finance `GET /api/integration/engagement-status` with `X-Api-Key`.
3. Discover matches customers by normalized email and optional Finance aliases.
4. Discover updates only `engagement_status` and `engagement_as_of` on matching clients.
5. Unmatched clients remain `unknown`.
6. Sync outcome is logged in `integration_sync_log`.

### Phase 2 Ingestion

1. Admin opens Ingestion.
2. Admin clicks Run Now or runs `npm run phase2:run`.
3. System fetches active source pages.
4. Unchanged content is skipped.
5. Changed content is extracted.
6. Candidate records must include a reachable client-facing link before inventory upsert.
7. Broad pages, missing links, blocked links, and low-confidence records go to Review or stay out of active inventory.
8. Expired events are archived and matches recompute.

### Review Queue Approval

1. Admin opens Review.
2. Admin inspects low-confidence or policy-flagged opportunities.
3. Approve writes a reviewed opportunity payload into Inventory.
4. Reject closes the review item and archives any linked event.
5. Reopen returns a previously closed item to the open review queue.

## Acceptance Criteria

- Local app starts on `http://127.0.0.1:4173/discover`.
- PostgreSQL is the persistence layer.
- Inventory and client data persist across restarts.
- Inventory list shows added date for each opportunity.
- Source registry setup imports the 45 workbook-backed EB-1A sources.
- Phase 2 run can complete against the real source registry without saving broad source pages as active opportunities.
- No Run Agent button or Discovery agent tab is visible.
- `/api/agent/run` is not shipped.
- Review approval writes an opportunity into Inventory.
- Match & Send hybrid match score includes semantic fit.
- No Intelligence tab or client portal preview is visible.
- `/api/phase4`, `/api/exports/evidence`, and `/api/exports/setu` are not shipped.
- Finance sync updates matched client engagement status by normalized email.
- Unmatched clients remain `unknown`.
- Dormant, inactive, unknown, or stale clients cannot receive email pushes.
- Active clients with fresh status can receive email pushes.
- Admin UI shows engagement status badges only, with no Finance amount/payment fields.
- Setup imports 20 vetted standing opportunities and keeps old fixture records inactive.
- Lint and production build pass.
