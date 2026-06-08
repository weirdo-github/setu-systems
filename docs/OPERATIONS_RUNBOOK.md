# Operations Runbook

## Daily Operator Checks

- Open `/finance` and confirm the finance dashboard loads after login.
- Open `/referral` and confirm public referral intake is reachable without finance login.
- Open `/discover` and confirm inventory, clients, matches, source registry, daily refresh, and review queue load.
- Check recent auth audit events in Finance Audit.
- Check Discover review queue for open ingestion items.
- Confirm email mode: sent through SMTP or logged locally as simulated.

## Deployment Smoke Tests

```bash
/usr/bin/curl -I http://127.0.0.1:4173/
/usr/bin/curl -I http://127.0.0.1:4173/finance
/usr/bin/curl -I http://127.0.0.1:4173/referral
/usr/bin/curl -I http://127.0.0.1:4173/discover
/usr/bin/curl -s http://127.0.0.1:4173/api/auth/status
/usr/bin/curl -s http://127.0.0.1:4173/api/discover/auth/session
```

Expected result: page routes return HTTP `200`, unauthenticated API checks return a JSON auth/session shape rather than a server error.

## Database Tasks

Run migrations:

```bash
npm run db:migrate
```

Seed or reseed Finance:

```bash
npm run db:seed
```

Set up Discover:

```bash
npm run db:discover:setup
```

Full local setup:

```bash
npm run db:setup
```

## Discover Ingestion

Manual run:

```bash
npm run phase2:run
```

Scheduler:

```bash
npm run phase2:schedule
```

The runner calls `/api/discover/ingestion/run` and requires `PHASE2_RUN_TOKEN`.

## Finance To Discover Engagement Sync

Run:

```bash
npm run finance:sync
```

Requirements:

- `FINANCE_BASE_URL`
- `FINANCE_INTEGRATION_KEY`
- `INTEGRATION_API_KEY` set to the same Finance-side key

Discover stores only the engagement status and timestamp. It does not store Finance payment, invoice, balance, or amount fields.

## Incident Response

| Symptom | First checks |
| --- | --- |
| App does not start | Confirm `.env`, `DATABASE_URL`, and port availability. |
| Finance login fails | Confirm `PORTAL_USERNAME`, `PORTAL_PASSWORD`, and `AUTH_SESSION_SECRET`. |
| Discover login fails | Confirm Discover seed/setup ran and `SESSION_SECRET` is set. |
| Discover APIs return Finance payloads | Confirm requests use `/api/discover/*`, not `/api/*`. |
| Ingestion fails | Confirm `PHASE2_RUN_TOKEN`, outbound network, source registry, and optional `OPENAI_API_KEY`. |
| Email is simulated | Confirm SMTP variables are configured and reachable. |
| Downloads fail | Confirm local storage path or S3 bucket permissions. |

## Backup And Restore

- Use RDS automated backups and point-in-time recovery.
- Export critical document storage from S3 with versioning enabled.
- Before destructive local reseeds, archive `server/storage` and take a database dump.

## Logging

- Application logs go to stdout/stderr.
- Production container logs should be captured in CloudWatch.
- Auth audit events are persisted in PostgreSQL with secret-safe request metadata.
