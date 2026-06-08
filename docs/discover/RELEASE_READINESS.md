# setu discovery Release Readiness

## Current Local Status

setu discovery is ready for local review on:

```text
http://127.0.0.1:4173/discover
```

The app expects local PostgreSQL on:

```text
postgres://discover:discover@localhost:5435/discover
```

Local review account:

```text
admin@discover.local / discover123
```

## Review Routes

- `/` - dashboard and active inventory metrics.
- `/inventory` - active opportunity inventory, added date, EB-1A category filtering, source/apply links, and details.
- `/clients` - client profile database with Finance engagement badges.
- `/match-send` - client search, AI-ranked matches, manual opportunity search, and gated email send flow.
- `/email-log` - outbound email attempt log.
- `/source-registry` - canonical source registry with predefined categories and multi-tag applicability.
- `/daily-refresh` - guarded source refresh run history and run trigger.
- `/review-queue` - human disposition for uncertain ingestion results.

## Removed Intelligence Surface

The current product does not ship the Intelligence section. There is no Intelligence tab, `/intelligence` workspace, `/api/phase4` endpoint, evidence export endpoint, curator proposal workspace, or client portal preview.

## Finance Gate Behavior

All opportunity pushes fail closed unless the selected client is:

- `active`
- has an `engagement_as_of` timestamp
- has a timestamp less than 24 hours old

Dormant, inactive, unknown, or stale clients can be viewed by admins but cannot receive new opportunity pushes or match recommendations.

## Product Artifacts In Repo

- `README.md` - local run instructions, product phase summary, and documentation index.
- `docs/PRODUCT_CAPABILITIES.md` - what the product can do now.
- `docs/FUNCTIONAL_SPEC.md` - functional behavior and acceptance criteria.
- `docs/NON_FUNCTIONAL_REQUIREMENTS.md` - reliability, privacy, security, performance, and operations requirements.
- `docs/NON_TECHNICAL_OVERVIEW.md` - plain-English operating model.
- `docs/TECHNICAL_ARCHITECTURE.md` - app stack, data model, routes, and integration points.
- `docs/FINANCE_ENGAGEMENT_INTEGRATION.md` - Setu Finance status-only integration contract.
- `docs/Discover_Product_Deck.pptx` - product slide deck.
- `data/source-registry.json` - normalized EB-1A master source registry.

## Code Areas

- `src/components/SetuDiscoverPortal.tsx` - main admin portal UI.
- `src/app/[section]/page.tsx` - direct section route support for browser back/forward navigation.
- `src/app/api/*` - authenticated API routes.
- `src/lib/repository.ts` - PostgreSQL persistence layer.
- `src/lib/engagement.ts` - centralized Finance engagement push gate.
- `src/lib/phase2-ingestion.ts` - guarded source refresh and review queue pipeline.
- `src/lib/matching.ts` - hybrid opportunity matching.
- `scripts/setup-db.mjs` - schema setup and seed import.
- `scripts/syncFinanceStatus.js` - Finance engagement full sync.

## Verification Checklist

Use this sequence before handoff:

```bash
npm run lint
npm run build
```

Runtime smoke checks:

```bash
curl -I http://127.0.0.1:4173/discover/
curl -I http://127.0.0.1:4173/discover/inventory
curl -I http://127.0.0.1:4173/discover/match-send
curl -I http://127.0.0.1:4173/discover/source-registry
```

Authenticated API smoke:

- login as `admin@discover.local`
- verify `/api/state` returns `200`
- verify `/api/matches` returns `200` when authenticated with a selected client
- verify `/intelligence`, `/phase4`, `/api/phase4`, `/api/exports/evidence`, and `/api/exports/setu` return `404`

## Current Known Boundary

If Finance status sync has not run in the last 24 hours, active clients become stale and match recommendations remain hidden. This is expected behavior, not a bug. Run `npm run finance:sync` when the Finance integration endpoint and key are configured.
