import { makeId, normalizeDateInput, normalizeMoneyInput, pool, query, toTextArray } from "@/lib/db";
import { deriveStatus } from "@/lib/status";
import type {
  ClientRecord,
  EmailLog,
  EngagementStatus,
  EventRecord,
  IngestionItem,
  IngestionRun,
  ReviewItem,
  Source,
  SourcePage,
} from "@/lib/types";

function withDerivedStatus(row: EventRecord): EventRecord {
  return {
    ...row,
    derived_status: deriveStatus(row.deadline, row.archived, row.manual_status),
  };
}

export async function listSources() {
  return query<Source>(
    `SELECT
       id, name, organization, source_category, criteria_tags, typical_fee,
       registry_rank, canonical_domain, seed_url, credibility_tier, status,
       refresh_enabled, notes
     FROM sources
     ORDER BY registry_rank NULLS LAST, credibility_tier ASC, name ASC`,
  );
}

export async function listSourcePages() {
  return query<SourcePage>(
    `SELECT source_pages.*, sources.name AS source_name
     FROM source_pages
     JOIN sources ON sources.id = source_pages.source_id
     ORDER BY sources.name ASC, source_pages.label ASC, source_pages.url ASC`,
  );
}

export async function listIngestionRuns() {
  return query<IngestionRun>(
    `SELECT *
     FROM ingestion_runs
     ORDER BY started_at DESC
     LIMIT 20`,
  );
}

export async function listIngestionItems(runId?: string) {
  if (!runId) {
    return query<IngestionItem>(
      `SELECT *
       FROM ingestion_items
       ORDER BY created_at DESC
       LIMIT 80`,
    );
  }

  return query<IngestionItem>(
    `SELECT *
     FROM ingestion_items
     WHERE run_id = $1
     ORDER BY created_at DESC`,
    [runId],
  );
}

export async function listReviewItems() {
  return query<ReviewItem>(
    `SELECT review_items.*, sources.name AS source_name
     FROM review_items
     LEFT JOIN sources ON sources.id = review_items.source_id
     ORDER BY
       CASE review_items.status WHEN 'open' THEN 0 ELSE 1 END,
       review_items.created_at DESC
     LIMIT 80`,
  );
}

export async function listEvents() {
  const rows = await query<EventRecord>(
    `SELECT events.*, sources.name AS source_name
     FROM events
     LEFT JOIN sources ON sources.id = events.source_id
     ORDER BY archived ASC, deadline NULLS LAST, title ASC`,
  );
  return rows.map(withDerivedStatus);
}

export async function listClients() {
  return query<ClientRecord>(
    `SELECT *
     FROM clients
     ORDER BY name ASC`,
  );
}

export async function getClientById(id: string) {
  const rows = await query<ClientRecord>(
    `SELECT *
     FROM clients
     WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function updateClientEngagementByEmails(payload: {
  emails: string[];
  status: EngagementStatus;
  asOf: string | null;
}) {
  const emails = payload.emails
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (!emails.length) return 0;

  const result = await pool.query(
    `UPDATE clients
     SET engagement_status = $1,
         engagement_as_of = $2,
         updated_at = now()
     WHERE lower(email) = ANY($3::text[])`,
    [payload.status, payload.asOf, emails],
  );

  return result.rowCount ?? 0;
}

export async function logIntegrationSync(payload: {
  source: string;
  matched: number;
  received: number;
  error?: string;
}) {
  await query(
    `INSERT INTO integration_sync_log(source, matched, received, error, ran_at)
     VALUES ($1, $2, $3, $4, now())`,
    [payload.source, payload.matched, payload.received, payload.error ?? ""],
  );
}

export async function listEmailLogs() {
  return query<EmailLog>(
    `SELECT email_logs.*, clients.name AS client_name, events.title AS event_title
     FROM email_logs
     JOIN clients ON clients.id = email_logs.client_id
     LEFT JOIN events ON events.id = email_logs.event_id
     ORDER BY email_logs.created_at DESC
     LIMIT 80`,
  );
}

export async function upsertEvent(payload: Record<string, unknown>, id?: string) {
  const eventId = id ?? makeId("evt");
  const values = [
    eventId,
    String(payload.title ?? "").trim(),
    String(payload.category ?? "Awards"),
    normalizeMoneyInput(payload.fee_amount),
    String(payload.fee_currency ?? "USD").trim() || "USD",
    String(payload.fee_purpose ?? "").trim(),
    Number(payload.credibility_tier ?? 2),
    String(payload.manual_status ?? "active").toLowerCase(),
    normalizeDateInput(payload.deadline),
    toTextArray(payload.criteria_tags),
    toTextArray(payload.keywords),
    String(payload.field ?? "").trim(),
    String(payload.location ?? "").trim(),
    String(payload.apply_url ?? "").trim(),
    String(payload.source_url ?? "").trim(),
    payload.source_id ? String(payload.source_id) : null,
    String(payload.summary ?? "").trim(),
    Number(payload.actionability ?? 3),
    normalizeMoneyInput(payload.extraction_confidence),
    payload.last_seen_at ? String(payload.last_seen_at) : null,
    payload.content_hash ? String(payload.content_hash) : null,
    String(payload.notes ?? "").trim(),
    Boolean(payload.archived),
  ];

  const rows = await query<EventRecord>(
    `INSERT INTO events (
       id, title, category, fee_amount, fee_currency, fee_purpose, credibility_tier,
       manual_status, deadline, criteria_tags, keywords, field, location, apply_url,
       source_url, source_id, summary, actionability, extraction_confidence,
       last_seen_at, content_hash, notes, archived
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::text[], $11::text[], $12, $13,
       $14, $15, $16, $17, $18, $19, $20, $21, $22, $23
     )
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title,
       category = EXCLUDED.category,
       fee_amount = EXCLUDED.fee_amount,
       fee_currency = EXCLUDED.fee_currency,
       fee_purpose = EXCLUDED.fee_purpose,
       credibility_tier = EXCLUDED.credibility_tier,
       manual_status = EXCLUDED.manual_status,
       deadline = EXCLUDED.deadline,
       criteria_tags = EXCLUDED.criteria_tags,
       keywords = EXCLUDED.keywords,
       field = EXCLUDED.field,
       location = EXCLUDED.location,
       apply_url = EXCLUDED.apply_url,
       source_url = EXCLUDED.source_url,
       source_id = EXCLUDED.source_id,
       summary = EXCLUDED.summary,
       actionability = EXCLUDED.actionability,
       extraction_confidence = EXCLUDED.extraction_confidence,
       last_seen_at = EXCLUDED.last_seen_at,
       content_hash = EXCLUDED.content_hash,
       notes = EXCLUDED.notes,
       archived = EXCLUDED.archived,
       updated_at = now()
     RETURNING *`,
    values,
  );

  return withDerivedStatus(rows[0]);
}

export async function upsertSource(payload: Record<string, unknown>, id?: string) {
  const sourceId = id ?? makeId("src");
  const rows = await query<Source>(
    `INSERT INTO sources (
       id, name, organization, source_category, criteria_tags, typical_fee,
       registry_rank, canonical_domain, seed_url, credibility_tier, status,
       refresh_enabled, notes
     )
     VALUES ($1, $2, $3, $4, $5::text[], $6, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       organization = EXCLUDED.organization,
       source_category = EXCLUDED.source_category,
       criteria_tags = EXCLUDED.criteria_tags,
       typical_fee = EXCLUDED.typical_fee,
       registry_rank = EXCLUDED.registry_rank,
       canonical_domain = EXCLUDED.canonical_domain,
       seed_url = EXCLUDED.seed_url,
       credibility_tier = EXCLUDED.credibility_tier,
       status = EXCLUDED.status,
       refresh_enabled = EXCLUDED.refresh_enabled,
       notes = EXCLUDED.notes,
       updated_at = now()
     RETURNING *`,
    [
      sourceId,
      String(payload.name ?? "").trim(),
      String(payload.organization ?? "").trim(),
      String(payload.source_category ?? "").trim(),
      toTextArray(payload.criteria_tags),
      String(payload.typical_fee ?? "").trim(),
      payload.registry_rank === null || payload.registry_rank === undefined || payload.registry_rank === ""
        ? null
        : Number(payload.registry_rank),
      String(payload.canonical_domain ?? "").trim().toLowerCase(),
      String(payload.seed_url ?? "").trim(),
      Number(payload.credibility_tier ?? 2),
      String(payload.status ?? "active").trim().toLowerCase(),
      payload.refresh_enabled !== false,
      String(payload.notes ?? "").trim(),
    ],
  );

  const source = rows[0];
  const seedUrl = String(payload.seed_url ?? "").trim();
  if (seedUrl) {
    await upsertSourcePage({
      source_id: source.id,
      url: seedUrl,
      label: "Seed page",
      status: "active",
    });
  }

  return source;
}

export async function upsertSourcePage(payload: Record<string, unknown>, id?: string) {
  const pageId = id ?? makeId("pg");
  const rows = await query<SourcePage>(
    `INSERT INTO source_pages (id, source_id, url, label, status, discovered_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (source_id, url) DO UPDATE SET
       label = EXCLUDED.label,
       status = EXCLUDED.status,
       discovered_by = EXCLUDED.discovered_by,
       updated_at = now()
     RETURNING *`,
    [
      pageId,
      String(payload.source_id ?? ""),
      String(payload.url ?? "").trim(),
      String(payload.label ?? "").trim(),
      String(payload.status ?? "active").trim().toLowerCase(),
      String(payload.discovered_by ?? "manual").trim() || "manual",
    ],
  );
  return rows[0];
}

export async function updateSourcePageHash(pageId: string, hash: string, changed: boolean) {
  await query(
    `UPDATE source_pages
     SET last_content_hash = $2,
         last_fetched_at = now(),
         last_changed_at = CASE WHEN $3 THEN now() ELSE last_changed_at END,
         updated_at = now()
     WHERE id = $1`,
    [pageId, hash, changed],
  );
}

export async function archiveEvent(id: string) {
  const rows = await query<EventRecord>(
    "UPDATE events SET archived = TRUE, updated_at = now() WHERE id = $1 RETURNING *",
    [id],
  );
  return rows[0] ? withDerivedStatus(rows[0]) : null;
}

export async function upsertClient(payload: Record<string, unknown>, id?: string) {
  const clientId = id ?? makeId("cli");
  const rows = await query<ClientRecord>(
    `INSERT INTO clients (
       id, name, email, field, location, target_criteria, covered_criteria,
       keywords, preferred_categories, notes
     )
     VALUES ($1, $2, $3, $4, $5, $6::text[], $7::text[], $8::text[], $9::text[], $10)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       email = EXCLUDED.email,
       field = EXCLUDED.field,
       location = EXCLUDED.location,
       target_criteria = EXCLUDED.target_criteria,
       covered_criteria = EXCLUDED.covered_criteria,
       keywords = EXCLUDED.keywords,
       preferred_categories = EXCLUDED.preferred_categories,
       notes = EXCLUDED.notes,
       updated_at = now()
     RETURNING *`,
    [
      clientId,
      String(payload.name ?? "").trim(),
      String(payload.email ?? "").trim(),
      String(payload.field ?? "").trim(),
      String(payload.location ?? "").trim(),
      toTextArray(payload.target_criteria),
      toTextArray(payload.covered_criteria),
      toTextArray(payload.keywords),
      toTextArray(payload.preferred_categories),
      String(payload.notes ?? "").trim(),
    ],
  );

  return rows[0];
}

export async function deleteClient(id: string) {
  await query("DELETE FROM clients WHERE id = $1", [id]);
}

export async function logRecommendation(
  clientId: string,
  eventId: string,
  score: number,
  breakdown: {
    criterionGap: number;
    credibility: number;
    keyword: number;
    actionability: number;
    location: number;
    total: number;
    [key: string]: unknown;
  },
) {
  const id = makeId("rec");
  await query(
    `INSERT INTO recommendations (
       id, client_id, event_id, score, criterion_gap_score, credibility_score,
       keyword_score, actionability_score, location_score, explanation
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
     ON CONFLICT (client_id, event_id) DO UPDATE SET
       score = EXCLUDED.score,
       criterion_gap_score = EXCLUDED.criterion_gap_score,
       credibility_score = EXCLUDED.credibility_score,
       keyword_score = EXCLUDED.keyword_score,
       actionability_score = EXCLUDED.actionability_score,
       location_score = EXCLUDED.location_score,
       explanation = EXCLUDED.explanation,
       updated_at = now()`,
    [
      id,
      clientId,
      eventId,
      score,
      breakdown.criterionGap,
      breakdown.credibility,
      breakdown.keyword,
      breakdown.actionability,
      breakdown.location,
      JSON.stringify(breakdown),
    ],
  );
}

export async function logEmail(payload: {
  clientId: string;
  eventId: string | null;
  toEmail: string;
  subject: string;
  body: string;
  providerStatus: string;
  providerMessageId?: string | null;
  sentBy: string;
}) {
  const rows = await query<EmailLog>(
    `INSERT INTO email_logs (
       id, client_id, event_id, to_email, subject, body, provider_status,
       provider_message_id, sent_by
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      makeId("eml"),
      payload.clientId,
      payload.eventId,
      payload.toEmail,
      payload.subject,
      payload.body,
      payload.providerStatus,
      payload.providerMessageId ?? null,
      payload.sentBy,
    ],
  );
  return rows[0];
}

export async function createIngestionRun(mode = "manual") {
  const rows = await query<IngestionRun>(
    `INSERT INTO ingestion_runs (id, status, mode)
     VALUES ($1, 'running', $2)
     RETURNING *`,
    [makeId("run"), mode],
  );
  return rows[0];
}

export async function updateIngestionRun(
  id: string,
  payload: Partial<
    Pick<
      IngestionRun,
      | "status"
      | "pages_checked"
      | "pages_changed"
      | "events_upserted"
      | "expired_purged"
      | "low_confidence_count"
      | "notes"
      | "error"
    >
  >,
) {
  const rows = await query<IngestionRun>(
    `UPDATE ingestion_runs
     SET status = COALESCE($2, status),
         pages_checked = COALESCE($3, pages_checked),
         pages_changed = COALESCE($4, pages_changed),
         events_upserted = COALESCE($5, events_upserted),
         expired_purged = COALESCE($6, expired_purged),
         low_confidence_count = COALESCE($7, low_confidence_count),
         notes = COALESCE($8, notes),
         error = COALESCE($9, error),
         finished_at = CASE WHEN COALESCE($2, status) IN ('completed', 'failed') THEN now() ELSE finished_at END
     WHERE id = $1
     RETURNING *`,
    [
      id,
      payload.status ?? null,
      payload.pages_checked ?? null,
      payload.pages_changed ?? null,
      payload.events_upserted ?? null,
      payload.expired_purged ?? null,
      payload.low_confidence_count ?? null,
      payload.notes ?? null,
      payload.error ?? null,
    ],
  );
  return rows[0];
}

export async function createIngestionItem(payload: {
  runId: string;
  sourceId?: string | null;
  pageUrl: string;
  contentHash?: string;
  changeStatus: string;
  extractionStatus: string;
  confidence?: number | null;
  eventId?: string | null;
  summary?: string;
  error?: string;
}) {
  const rows = await query<IngestionItem>(
    `INSERT INTO ingestion_items (
       id, run_id, source_id, page_url, content_hash, change_status,
       extraction_status, confidence, event_id, summary, error
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      makeId("itm"),
      payload.runId,
      payload.sourceId ?? null,
      payload.pageUrl,
      payload.contentHash ?? "",
      payload.changeStatus,
      payload.extractionStatus,
      payload.confidence ?? null,
      payload.eventId ?? null,
      payload.summary ?? "",
      payload.error ?? "",
    ],
  );
  return rows[0];
}

export async function createReviewItem(payload: {
  runId?: string | null;
  eventId?: string | null;
  sourceId?: string | null;
  pageUrl: string;
  title: string;
  reason: string;
  confidence?: number | null;
  payload: Record<string, unknown>;
}) {
  const rows = await query<ReviewItem>(
    `INSERT INTO review_items (
       id, run_id, event_id, source_id, page_url, title, reason, confidence, payload
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
     RETURNING *`,
    [
      makeId("rev"),
      payload.runId ?? null,
      payload.eventId ?? null,
      payload.sourceId ?? null,
      payload.pageUrl,
      payload.title,
      payload.reason,
      payload.confidence ?? null,
      JSON.stringify(payload.payload),
    ],
  );
  return rows[0];
}

export async function purgeExpiredEvents() {
  const rows = await query<{ count: string }>(
    `WITH expired AS (
       UPDATE events
       SET archived = TRUE, updated_at = now()
       WHERE archived = FALSE AND deadline IS NOT NULL AND deadline < CURRENT_DATE
       RETURNING id
     )
     SELECT count(*)::text AS count FROM expired`,
  );
  return Number(rows[0]?.count ?? 0);
}

export async function updateReviewItemStatus(id: string, status: string) {
  const rows = await query<ReviewItem>(
    `UPDATE review_items
     SET status = $2, updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, status],
  );
  return rows[0] ?? null;
}
