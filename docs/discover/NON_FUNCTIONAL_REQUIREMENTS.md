# setu discovery Nonfunctional Requirements

## Deployment Model

- The application is local-first.
- The default local URL is `http://127.0.0.1:4173/discover`.
- PostgreSQL is required for persistence.
- Docker Compose provides a reproducible local database and app runtime.
- Bare local mode is supported when PostgreSQL is already running.

## Reliability

- Phase 2 skips unchanged pages using content hashes.
- Sources that return zero candidates create alerts for likely layout changes.

## Safety and Guardrails

- Fetches are restricted to canonical source domains.
- Local fixture URLs are allowed only under `/phase2-fixtures/` for review/demo use.
- Denylisted domains are blocked.
- Pay-to-play concerns are routed to human review when fees and low credibility tiers indicate risk.
- Customer engagement gating fails closed: missing, unknown, dormant, inactive, or stale status blocks pushes.
- Finance grace thresholds are not computed in Discover; Discover consumes only the Finance-owned flag.

## Security

- Secrets must remain in `.env.local`, `.env`, host environment variables, or deployment secret stores.
- `.env.local` is ignored by git.
- `OPENAI_API_KEY` must never be committed.
- `FINANCE_INTEGRATION_KEY` and `WEBHOOK_SECRET` must never be committed.
- Discover does not connect to the Finance database.
- Discover does not store Finance amount, invoice, payment, balance, or threshold fields.
- Run-token access uses `PHASE2_RUN_TOKEN` for local Phase 2 automation endpoints.
- The current local auth is team/admin oriented; public client login is out of scope.

## Performance

- Phase 2 avoids repeated LLM/model work on unchanged pages.
- Match & Send semantic scoring is local and deterministic by default.
- Match recomputation is scoped to top ranked opportunities per client.
- Current scale target is local/team usage with curated source registry size.

## Observability

- Phase 2 exposes ingestion run history and extraction item reports.
- Review queue count is visible in navigation.
- Match & Send exposes match score breakdowns.
- Finance sync writes received/matched counts and errors to `integration_sync_log`.
- Admin screens expose only the engagement flag and timestamp.

## Maintainability

- The `events` table remains the system-of-record spine.
- Phase 2 uses guarded fetch and extraction primitives.
- Match & Send keeps semantic score in the match breakdown contract so future Qdrant embeddings can replace the local scorer without changing UI surfaces.
- UI components follow the existing Discover visual language.
- Tables are responsive and verified for no horizontal overflow on mobile and desktop.

## Compliance and Data Handling

- The product stores opportunity/source/client records in local PostgreSQL.
- It does not store OpenAI responses separately beyond extracted opportunity payloads and review payloads.
- Operators should treat client profile data as sensitive.
- Any hosted deployment should add managed secrets, backups, TLS, and stricter auth before production use.
