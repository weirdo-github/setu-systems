# setu discovery Nontechnical Overview

## What It Is

setu discovery is an internal discovery workbench for finding profile-building opportunities that can support a client's evidence portfolio. The product helps the team move from manual research to structured, reviewable discovery.

## What It Helps The Team Do

- Keep a single inventory of awards, judging panels, press opportunities, speaking calls, and similar profile-building records.
- Filter that inventory by EB-1A category for faster review.
- Keep client profile priorities in one place.
- Search clients quickly from the Match & Send workflow.
- Match clients to opportunities using visible scoring.
- Search for a specific opportunity and manually send it to a selected client.
- Make sure only Finance-active clients receive new opportunity recommendations.
- Email relevant opportunities to clients.
- Refresh opportunities from trusted sources.
- Route uncertain results to a human before they become client-facing recommendations.
- Add source applicability tags from predefined EB-1A categories.

## How The Phases Work

### Phase 1

The team manually enters opportunities and clients, then matches and emails opportunities. This establishes the system of record.

### Phase 2

The system checks trusted source pages every day or on demand. It skips pages that have not changed and extracts opportunity details from pages that did change.

### Paused Agent Capability

The Discovery agent runner is currently removed from the product. The team uses Daily Refresh to check trusted source pages and the Review queue to approve uncertain results.

### Removed Intelligence Section

The Intelligence section is removed from the current product. The team now uses Match & Send for hybrid matching, Source Registry for trusted sources, Daily Refresh for source checks, and Review Queue for human disposition.

## Finance Status Connection

Discover reads one status flag from Setu Finance: active, dormant, inactive, or unknown. Finance owns the rule behind that flag. Discover does not see payment amounts or connect to Finance's database.

When a client is not active, or when the last Finance status is stale, Discover hides new recommendations and blocks outbound opportunity emails. Admins can still see the client profile and the engagement badge.

Status meaning:

| Status | Finance portal | Discover portal |
| --- | --- | --- |
| Active | Customer is eligible under Finance-owned engagement rules. | Pushes are allowed only if the timestamp is fresh. |
| Dormant | Customer is present but not currently active for new outreach. | New recommendations and sends are blocked. |
| Inactive | Customer is not eligible for current engagement activity. | New recommendations and sends are blocked. |
| Unknown | Discover has no confirmed Finance status yet. | The client remains non-pushable until Finance confirms fresh active status. |

## What Humans Still Control

- Which sources are trusted.
- Which uncertain opportunities are approved or rejected.
- Which opportunities are sent to clients.
- Finance owns whether a client is active, dormant, or inactive.
- Source credibility tiers and source status.
- Final client communication.

## What AI Does

AI is optional and scoped. Phase 2 can use OpenAI structured extraction when changed source content needs parsing. Match & Send semantic scoring is deterministic and local by default. AI does not control login, CRUD, source allowlists, source approval, review approval, or email sending.

## Review Queue Meaning

The review queue is where the product asks a human to decide. Items appear when extraction confidence is low or a policy rule says the opportunity should not be automatically accepted. Approving an item puts it into the inventory. Rejecting it closes it out.

## Current Local Review Account

- Admin: `admin@discover.local`
- Password: `discover123`

These credentials are for local review only.
