# Setu Media Portal

## Purpose

Setu Media adds a dedicated writer workspace and a Discover-admin media tracker to the Setu Systems product suite. Media supports EB-1A-aligned article work for Discover clients while keeping Finance data out of the workflow.

## Surfaces

| Surface | Route | Audience | Purpose |
| --- | --- | --- | --- |
| Discover Media tracker | `/discover/media` | Discover admins | Assign articles, track writer progress, review work, record publisher/live links, close or reopen assignments. |
| Media writer portal | `/media` | Media writers | View own assignments, start work, save notes/drafts/submissions, submit completed work, and review completed history. |
| Admin API | `/api/discover/media/*` | Discover admins | Admin assignment CRUD, status transitions, writer lookup, and client media panels. |
| Writer API | `/api/media/*` | Media writers | Media auth, writer assignment list/detail, start, work log, and submit. |

## Local Demo Access

Discover admin:

- `admin@discover.local` / `discover123`

Media writers:

- `writer1@media.local` / `media123`
- `writer2@media.local` / `media123`

Rotate or replace these before any shared or hosted environment is exposed.

## Data Ownership

Media is part of the Discover data plane. It uses:

- `media_users`
- `media_sessions`
- `media_assignments`
- `media_assignment_events`
- `media_work_log`
- `media_assignment_code_seq`

Finance modules, Finance migrations, and Finance state stores are not used by Media. Writers never see invoice amounts, balances, payment details, memos, or raw transaction data.

## Assignment Lifecycle

```text
assigned -> active -> submitted -> published -> closed
       \\-> incomplete_closed
submitted -> active  (admin return)
closed/incomplete_closed -> active  (admin reopen)
```

Writer transitions:

- `assigned -> active`
- `active -> submitted`
- save unlimited `note`, `draft`, or `submission` work-log entries while active

Discover admin transitions:

- create `assigned`
- edit article title, criterion, brief, due date, and writer while `assigned`, `active`, or `submitted`
- reassign writer
- return `submitted -> active`
- record publisher and live link as `published`
- close `published -> closed`
- incomplete-close `assigned|active|submitted -> incomplete_closed`
- reopen `closed|incomplete_closed -> active`

Every status change and edit writes a `media_assignment_events` row.

## EB-1A Criteria

Supported assignment tags:

- `published_material`
- `original_contributions`
- `authorship`
- `judging`
- `awards`
- `leading_role`
- `other`

## Privacy Rules

- Writer assignment views show only client display name, article title, EB-1A criterion, brief, due date, status, and that writer's own work log.
- Writers cannot publish, set publisher names, set live links, see other writers' assignments, or access Discover admin tools.
- Discover admins record publisher names and live publication links.
- Client media panels in Discover show assignment status and saved live links against the Discover client record.
- No Media code reads Finance tables or Finance state directly.

## Regression Checklist

Run before release:

```bash
npm run db:discover:setup
npm run build
npm run lint
/usr/bin/curl -I http://127.0.0.1:4173/
/usr/bin/curl -I http://127.0.0.1:4173/finance
/usr/bin/curl -I http://127.0.0.1:4173/referral
/usr/bin/curl -I http://127.0.0.1:4173/discover
/usr/bin/curl -I http://127.0.0.1:4173/media
```

Manual/API checks:

- Discover admin creates a Media assignment for an existing Discover client.
- Admin edits title/due date and sees an `edited` event.
- Writer 1 sees the assignment, starts it, saves a draft, and submits it.
- Admin records publisher and live link, then closes the assignment.
- Admin creates a second assignment and reassigns it from Writer 1 to Writer 2.
- Writer 1 no longer sees the reassigned assignment.
- Writer 2 sees the reassigned assignment.
- Client media panel API returns the closed assignment and live link.
- Browser checks show no horizontal overflow on `/`, `/discover/media`, or `/media`.
