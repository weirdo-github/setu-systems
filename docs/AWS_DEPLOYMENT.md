# AWS Deployment Guide

## Recommended Starting Architecture

Use a single containerized Node/Next.js service with managed PostgreSQL:

- AWS App Runner or ECS Fargate for the web service.
- Amazon RDS PostgreSQL or Aurora PostgreSQL Serverless v2 for the database.
- AWS Secrets Manager or SSM Parameter Store for secrets.
- Private S3 bucket for contract, receipt, payslip, and attachment storage.
- CloudWatch Logs for application logs.
- Route 53 and ACM for custom domain and TLS.

This is the lowest-complexity production path while keeping the system ready for later worker/service separation.

## Build And Run

Container build command:

```bash
npm ci
npm run build
```

Runtime command:

```bash
npm run start
```

The service listens on `PORT`, defaulting locally to `4173`. In App Runner/ECS, set `PORT` to the platform-provided value when required.

## Required Environment Variables

| Variable | Production value |
| --- | --- |
| `NODE_ENV` | `production` |
| `PORT` | Platform port |
| `HOST` | `0.0.0.0` |
| `DATABASE_URL` | RDS/Aurora PostgreSQL connection string |
| `DATABASE_SSL` | `true` if the database requires SSL |
| `AUTH_SESSION_SECRET` | Long random secret |
| `AUTH_AUDIT_HASH_SALT` | Separate long random salt |
| `PORTAL_USERNAME` | Finance admin username |
| `PORTAL_PASSWORD` | Finance admin password or temporary bootstrap secret |
| `SESSION_SECRET` | Discover session signing secret |
| `INTEGRATION_API_KEY` | Finance provider status API key |
| `FINANCE_INTEGRATION_KEY` | Same key for Discover sync when running in one environment |
| `WEBHOOK_SECRET` | Long random webhook secret |
| `SMTP_*` | Production SMTP provider settings |
| `OPENAI_API_KEY` | Optional for structured Discover extraction |
| `CONTRACT_STORAGE_BUCKET` | Private S3 bucket name |
| `AWS_REGION` | Deployment region |

## Database Deployment Order

1. Create database and credentials.
2. Set `DATABASE_URL` and `DATABASE_SSL`.
3. Run:
   ```bash
   npm run db:migrate
   npm run db:seed
   npm run db:discover:setup
   ```
4. Start the app.
5. Smoke test `/`, `/finance`, `/referral`, `/discover`, `/media`, `/api/auth/status`, `/api/discover/auth/session`, and `/api/media/auth/session`.

## Storage

Local development can use `server/storage`. Production should use private S3 and short-lived downloads when the storage adapter is enabled. Bucket requirements:

- Block public access.
- Enable default encryption.
- Use lifecycle rules for temporary/generated files where appropriate.
- Restrict IAM permissions to the app task role.

## Cost Controls

- Start with one web service and one PostgreSQL database.
- Use scheduled Discover ingestion, not always-on crawler fleets.
- Keep email/Gmail sync intervals conservative.
- Add a separate worker only when long-running jobs affect web latency.
- Use CloudWatch log retention policies.

## Production Hardening Checklist

- Rotate all local default credentials.
- Configure TLS through ACM.
- Set database SSL.
- Move all secrets to Secrets Manager or SSM.
- Enable RDS automated backups.
- Enable CloudWatch alarms for app 5xx, CPU, memory, DB connections, and storage.
- Verify Finance provider integration exposes status only, never amount data.
- Verify Media writer views expose only client display names, article briefs, criteria, timelines, statuses, and writer-owned work logs.
- Rotate or replace the local seeded Media writer credentials before exposing any shared environment.
- Verify auth audit logs do not store passwords, API keys, tokens, raw IPs, or raw user agents.
