import type { PoolClient } from "pg";
import { MEDIA_CRITERIA_TAGS, MEDIA_WORK_ENTRY_TYPES } from "@/lib/constants";
import { makeId, normalizeDateInput, pool, query } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import type {
  ClientRecord,
  MediaAssignment,
  MediaAssignmentDetail,
  MediaAssignmentEvent,
  MediaAssignmentStatus,
  MediaUser,
  MediaWorkLog,
} from "@/lib/types";

type ActorType = "discover_admin" | "media" | "system";

type EventPayload = {
  assignmentId: string;
  actorType: ActorType;
  actorId?: string | null;
  kind: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  note?: string | null;
};

const editableStatuses = new Set(["assigned", "active", "submitted"]);
const terminalStatuses = new Set(["closed", "incomplete_closed"]);
const criteriaValues = new Set<string>(MEDIA_CRITERIA_TAGS);
const workEntryTypes = new Set<string>(MEDIA_WORK_ENTRY_TYPES);

export class MediaRepositoryError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function cleanNullableText(value: unknown) {
  const text = cleanText(value);
  return text || null;
}

function cleanCriterion(value: unknown) {
  const text = cleanText(value);
  if (!text) return null;
  if (!criteriaValues.has(text)) {
    throw new MediaRepositoryError("Unsupported EB-1A media criterion.", 422);
  }
  return text;
}

function summarizeValue(value: unknown) {
  const text = cleanText(value).replace(/\s+/g, " ");
  if (!text) return "empty";
  return text.length > 86 ? `${text.slice(0, 83)}...` : text;
}

async function insertAssignmentEvent(client: PoolClient, payload: EventPayload) {
  await query(
    `INSERT INTO media_assignment_events (
       id, assignment_id, actor_type, actor_id, kind, from_status, to_status, note
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      makeId("mae"),
      payload.assignmentId,
      payload.actorType,
      payload.actorId ?? null,
      payload.kind,
      payload.fromStatus ?? null,
      payload.toStatus ?? null,
      payload.note ?? null,
    ],
    client,
  );
}

async function nextMediaAssignmentCode(client: PoolClient) {
  const rows = await query<{ value: number }>(
    "SELECT nextval('media_assignment_code_seq')::int AS value",
    [],
    client,
  );
  return `MED-${new Date().getFullYear()}-${String(rows[0].value).padStart(6, "0")}`;
}

async function getClientForAssignment(clientId: string, client?: PoolClient) {
  const rows = await query<ClientRecord>(
    "SELECT * FROM clients WHERE id = $1 LIMIT 1",
    [clientId],
    client,
  );
  return rows[0] ?? null;
}

async function getWriter(writerId: string, client?: PoolClient) {
  const rows = await query<MediaUser>(
    `SELECT id, email, display_name, role, active
     FROM media_users
     WHERE id = $1 AND active = TRUE
     LIMIT 1`,
    [writerId],
    client,
  );
  return rows[0] ?? null;
}

async function requireAssignment(id: string, client: PoolClient, lock = false) {
  const rows = await query<MediaAssignment>(
    `${assignmentSelectSql()}
     WHERE media_assignments.id = $1
     ${lock ? "FOR UPDATE OF media_assignments" : ""}`,
    [id],
    client,
  );
  const assignment = rows[0];
  if (!assignment) throw new MediaRepositoryError("Media assignment not found.", 404);
  return assignment;
}

function assignmentSelectSql() {
  return `SELECT
       media_assignments.*,
       media_users.display_name AS writer_name,
       media_users.email AS writer_email,
       COALESCE(event_counts.event_count, 0)::int AS event_count,
       COALESCE(work_counts.work_log_count, 0)::int AS work_log_count
     FROM media_assignments
     LEFT JOIN media_users ON media_users.id = media_assignments.media_user_id
     LEFT JOIN (
       SELECT assignment_id, count(*) AS event_count
       FROM media_assignment_events
       GROUP BY assignment_id
     ) event_counts ON event_counts.assignment_id = media_assignments.id
     LEFT JOIN (
       SELECT assignment_id, count(*) AS work_log_count
       FROM media_work_log
       GROUP BY assignment_id
     ) work_counts ON work_counts.assignment_id = media_assignments.id`;
}

async function listEvents(assignmentId: string, client?: PoolClient) {
  return query<MediaAssignmentEvent>(
    `SELECT *
     FROM media_assignment_events
     WHERE assignment_id = $1
     ORDER BY created_at ASC`,
    [assignmentId],
    client,
  );
}

async function listWorkLog(assignmentId: string, client?: PoolClient) {
  return query<MediaWorkLog>(
    `SELECT media_work_log.*, media_users.display_name AS writer_name
     FROM media_work_log
     JOIN media_users ON media_users.id = media_work_log.media_user_id
     WHERE assignment_id = $1
     ORDER BY media_work_log.created_at DESC`,
    [assignmentId],
    client,
  );
}

async function assignmentDetail(assignment: MediaAssignment, client?: PoolClient): Promise<MediaAssignmentDetail> {
  const [events, workLog] = await Promise.all([
    listEvents(assignment.id, client),
    listWorkLog(assignment.id, client),
  ]);
  return { ...assignment, events, work_log: workLog };
}

export async function verifyMediaLogin(email: string, password: string) {
  const rows = await query<MediaUser & { password_hash: string }>(
    `SELECT id, email, display_name, role, active, password_hash
     FROM media_users
     WHERE lower(email) = $1 AND active = TRUE
     LIMIT 1`,
    [email.trim().toLowerCase()],
  );
  const user = rows[0];
  if (!user || !verifyPassword(password, user.password_hash)) return null;
  return {
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    role: user.role,
    active: user.active,
    created_at: user.created_at,
  };
}

export async function listMediaWriters() {
  return query<MediaUser>(
    `SELECT id, email, display_name, role, active, created_at
     FROM media_users
     WHERE active = TRUE
     ORDER BY display_name ASC`,
  );
}

export async function listAssignmentsForWriter(writerId: string, status?: string | null) {
  const requestedStatus = cleanText(status);
  return query<MediaAssignment>(
    `${assignmentSelectSql()}
     WHERE media_assignments.media_user_id = $1
       AND ($2 = '' OR media_assignments.status = $2)
     ORDER BY
       CASE media_assignments.status
         WHEN 'assigned' THEN 0
         WHEN 'active' THEN 1
         WHEN 'submitted' THEN 2
         WHEN 'published' THEN 3
         ELSE 4
       END,
       media_assignments.due_date NULLS LAST,
       media_assignments.updated_at DESC`,
    [writerId, requestedStatus],
  );
}

export async function listAssignmentsForAdmin(filters: {
  status?: string | null;
  writerId?: string | null;
} = {}) {
  return query<MediaAssignment>(
    `${assignmentSelectSql()}
     WHERE ($1 = '' OR media_assignments.status = $1)
       AND ($2 = '' OR media_assignments.media_user_id = $2)
     ORDER BY media_assignments.updated_at DESC, media_assignments.due_date NULLS LAST`,
    [cleanText(filters.status), cleanText(filters.writerId)],
  );
}

export async function listClientMediaAssignments(clientId: string) {
  return query<MediaAssignment>(
    `${assignmentSelectSql()}
     WHERE media_assignments.discover_client_id = $1
     ORDER BY media_assignments.updated_at DESC`,
    [clientId],
  );
}

export async function getAssignmentForAdmin(id: string) {
  const rows = await query<MediaAssignment>(
    `${assignmentSelectSql()}
     WHERE media_assignments.id = $1
     LIMIT 1`,
    [id],
  );
  const assignment = rows[0];
  if (!assignment) throw new MediaRepositoryError("Media assignment not found.", 404);
  return assignmentDetail(assignment);
}

export async function getAssignmentForWriter(id: string, writerId: string) {
  const rows = await query<MediaAssignment>(
    `${assignmentSelectSql()}
     WHERE media_assignments.id = $1
       AND media_assignments.media_user_id = $2
     LIMIT 1`,
    [id, writerId],
  );
  const assignment = rows[0];
  if (!assignment) throw new MediaRepositoryError("Media assignment not found.", 404);
  return assignmentDetail(assignment);
}

export async function createAssignment(payload: Record<string, unknown>, assignedBy: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const discoverClientId = cleanText(payload.discover_client_id ?? payload.clientId);
    const discoverClient = await getClientForAssignment(discoverClientId, client);
    if (!discoverClient) throw new MediaRepositoryError("Select an existing Discover client.", 422);

    const mediaUserId = cleanText(payload.media_user_id ?? payload.writerId);
    const writer = await getWriter(mediaUserId, client);
    if (!writer) throw new MediaRepositoryError("Select an active media writer.", 422);

    const title = cleanText(payload.article_title ?? payload.articleTitle);
    if (!title) throw new MediaRepositoryError("Article title is required.", 422);

    const assignmentId = makeId("med");
    const status: MediaAssignmentStatus = "assigned";
    const rows = await query<MediaAssignment>(
      `INSERT INTO media_assignments (
         id, code, discover_client_id, client_display_name, media_user_id, article_title,
         eb1a_criterion, brief, assigned_by, due_date, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        assignmentId,
        await nextMediaAssignmentCode(client),
        discoverClient.id,
        discoverClient.name,
        writer.id,
        title,
        cleanCriterion(payload.eb1a_criterion),
        cleanNullableText(payload.brief),
        assignedBy,
        normalizeDateInput(cleanText(payload.due_date ?? payload.dueDate)),
        status,
      ],
      client,
    );

    await insertAssignmentEvent(client, {
      assignmentId,
      actorType: "discover_admin",
      actorId: assignedBy,
      kind: "assigned",
      toStatus: status,
      note: `Assigned to ${writer.display_name}`,
    });

    await client.query("COMMIT");
    return getAssignmentForAdmin(rows[0].id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateAssignment(
  id: string,
  payload: Record<string, unknown>,
  actorId: string,
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await requireAssignment(id, client, true);
    const status = current.status;

    if (terminalStatuses.has(status)) {
      throw new MediaRepositoryError("Closed media assignments are read-only. Reopen before editing.", 409);
    }

    const next = {
      article_title: current.article_title,
      eb1a_criterion: current.eb1a_criterion,
      brief: current.brief,
      due_date: current.due_date,
      media_user_id: current.media_user_id,
      publisher_name: current.publisher_name,
      published_url: current.published_url,
      published_at: current.published_at,
    };
    const diffs: string[] = [];
    let reassigned = false;

    if (status === "published") {
      for (const field of ["publisher_name", "published_url", "published_at"] as const) {
        if (Object.prototype.hasOwnProperty.call(payload, field)) {
          const value = field === "published_at"
            ? cleanNullableText(payload[field])
            : cleanNullableText(payload[field]);
          if (value !== next[field]) {
            diffs.push(`${field}: ${summarizeValue(next[field])} -> ${summarizeValue(value)}`);
            next[field] = value;
          }
        }
      }
    } else if (editableStatuses.has(status)) {
      if (Object.prototype.hasOwnProperty.call(payload, "article_title")) {
        const value = cleanText(payload.article_title);
        if (!value) throw new MediaRepositoryError("Article title is required.", 422);
        if (value !== next.article_title) {
          diffs.push(`article_title: ${summarizeValue(next.article_title)} -> ${summarizeValue(value)}`);
          next.article_title = value;
        }
      }

      if (Object.prototype.hasOwnProperty.call(payload, "eb1a_criterion")) {
        const value = cleanCriterion(payload.eb1a_criterion);
        if (value !== next.eb1a_criterion) {
          diffs.push(`eb1a_criterion: ${summarizeValue(next.eb1a_criterion)} -> ${summarizeValue(value)}`);
          next.eb1a_criterion = value;
        }
      }

      if (Object.prototype.hasOwnProperty.call(payload, "brief")) {
        const value = cleanNullableText(payload.brief);
        if (value !== next.brief) {
          diffs.push(`brief: ${summarizeValue(next.brief)} -> ${summarizeValue(value)}`);
          next.brief = value;
        }
      }

      if (Object.prototype.hasOwnProperty.call(payload, "due_date")) {
        const value = normalizeDateInput(cleanText(payload.due_date));
        if (value !== next.due_date) {
          diffs.push(`due_date: ${summarizeValue(next.due_date)} -> ${summarizeValue(value)}`);
          next.due_date = value;
        }
      }

      if (Object.prototype.hasOwnProperty.call(payload, "media_user_id")) {
        const value = cleanText(payload.media_user_id) || null;
        if (value) {
          const writer = await getWriter(value, client);
          if (!writer) throw new MediaRepositoryError("Select an active media writer.", 422);
        }
        if (value !== next.media_user_id) {
          diffs.push(`media_user_id: ${summarizeValue(next.media_user_id)} -> ${summarizeValue(value)}`);
          next.media_user_id = value;
          reassigned = true;
        }
      }
    } else {
      throw new MediaRepositoryError("This media assignment cannot be edited in its current status.", 409);
    }

    if (!diffs.length) {
      await client.query("COMMIT");
      return getAssignmentForAdmin(id);
    }

    await query(
      `UPDATE media_assignments
       SET article_title = $2,
           eb1a_criterion = $3,
           brief = $4,
           due_date = $5,
           media_user_id = $6,
           publisher_name = $7,
           published_url = $8,
           published_at = $9,
           updated_at = now()
       WHERE id = $1`,
      [
        id,
        next.article_title,
        next.eb1a_criterion,
        next.brief,
        next.due_date,
        next.media_user_id,
        next.publisher_name,
        next.published_url,
        next.published_at,
      ],
      client,
    );

    await insertAssignmentEvent(client, {
      assignmentId: id,
      actorType: "discover_admin",
      actorId,
      kind: reassigned ? "reassigned" : "edited",
      fromStatus: status,
      toStatus: status,
      note: diffs.join("; "),
    });

    await client.query("COMMIT");
    return getAssignmentForAdmin(id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function setAssignmentStatus(
  id: string,
  actor: { type: ActorType; id: string },
  toStatus: MediaAssignmentStatus,
  options: {
    allowedFrom: MediaAssignmentStatus[];
    kind: string;
    note?: string | null;
    writerId?: string;
    update?: string;
    values?: unknown[];
  },
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await requireAssignment(id, client, true);
    if (options.writerId && current.media_user_id !== options.writerId) {
      throw new MediaRepositoryError("Media assignment not found.", 404);
    }
    if (!options.allowedFrom.includes(current.status)) {
      throw new MediaRepositoryError(
        `Cannot move assignment from ${current.status} to ${toStatus}.`,
        409,
      );
    }

    await query(
      `UPDATE media_assignments
       SET status = $2,
           updated_at = now()
           ${options.update ?? ""}
       WHERE id = $1`,
      [id, toStatus, ...(options.values ?? [])],
      client,
    );

    await insertAssignmentEvent(client, {
      assignmentId: id,
      actorType: actor.type,
      actorId: actor.id,
      kind: options.kind,
      fromStatus: current.status,
      toStatus,
      note: options.note ?? null,
    });

    await client.query("COMMIT");
    return actor.type === "media" ? getAssignmentForWriter(id, actor.id) : getAssignmentForAdmin(id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function startAssignment(id: string, writerId: string) {
  return setAssignmentStatus(
    id,
    { type: "media", id: writerId },
    "active",
    {
      allowedFrom: ["assigned"],
      kind: "started",
      writerId,
    },
  );
}

export async function addWorkLogEntry(
  assignmentId: string,
  writerId: string,
  payload: Record<string, unknown>,
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const assignment = await requireAssignment(assignmentId, client, true);
    if (assignment.media_user_id !== writerId) {
      throw new MediaRepositoryError("Media assignment not found.", 404);
    }
    if (assignment.status !== "active") {
      throw new MediaRepositoryError("Work can be saved only after the assignment is active.", 409);
    }

    const entryType = cleanText(payload.entry_type || "note");
    if (!workEntryTypes.has(entryType)) {
      throw new MediaRepositoryError("Unsupported work-log entry type.", 422);
    }

    await query(
      `INSERT INTO media_work_log (
         id, assignment_id, media_user_id, entry_type, title, body, draft_url
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        makeId("mwl"),
        assignmentId,
        writerId,
        entryType,
        cleanNullableText(payload.title),
        cleanNullableText(payload.body),
        cleanNullableText(payload.draft_url),
      ],
      client,
    );

    await insertAssignmentEvent(client, {
      assignmentId,
      actorType: "media",
      actorId: writerId,
      kind: entryType === "submission" ? "submitted_work_saved" : "draft_saved",
      fromStatus: assignment.status,
      toStatus: assignment.status,
      note: cleanNullableText(payload.title) ?? entryType,
    });

    await client.query("COMMIT");
    return getAssignmentForWriter(assignmentId, writerId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function submitAssignment(
  id: string,
  writerId: string,
  payload: Record<string, unknown> = {},
) {
  if (cleanText(payload.body) || cleanText(payload.draft_url) || cleanText(payload.title)) {
    await addWorkLogEntry(id, writerId, {
      entry_type: "submission",
      title: payload.title || "Submission",
      body: payload.body,
      draft_url: payload.draft_url,
    });
  }

  return setAssignmentStatus(
    id,
    { type: "media", id: writerId },
    "submitted",
    {
      allowedFrom: ["active"],
      kind: "submitted",
      writerId,
      note: cleanNullableText(payload.note),
    },
  );
}

export async function returnAssignment(id: string, actorId: string, note?: string | null) {
  return setAssignmentStatus(
    id,
    { type: "discover_admin", id: actorId },
    "active",
    {
      allowedFrom: ["submitted"],
      kind: "returned",
      note,
    },
  );
}

export async function recordPublication(
  id: string,
  actorId: string,
  payload: Record<string, unknown>,
) {
  const publisherName = cleanText(payload.publisher_name);
  const publishedUrl = cleanText(payload.published_url);
  if (!publisherName || !publishedUrl) {
    throw new MediaRepositoryError("Publisher and live link are required.", 422);
  }

  return setAssignmentStatus(
    id,
    { type: "discover_admin", id: actorId },
    "published",
    {
      allowedFrom: ["submitted", "published"],
      kind: "published",
      note: `Published by ${publisherName}: ${publishedUrl}`,
      update: `,
           publisher_name = $3,
           published_url = $4,
           published_at = COALESCE($5::timestamptz, now())`,
      values: [
        publisherName,
        publishedUrl,
        cleanNullableText(payload.published_at),
      ],
    },
  );
}

export async function closeAssignment(id: string, actorId: string, note?: string | null) {
  return setAssignmentStatus(
    id,
    { type: "discover_admin", id: actorId },
    "closed",
    {
      allowedFrom: ["published"],
      kind: "closed",
      note,
      update: ", delivered_at = now(), closed_reason = $3",
      values: [cleanNullableText(note)],
    },
  );
}

export async function incompleteCloseAssignment(id: string, actorId: string, reason: string) {
  const note = cleanText(reason);
  if (!note) throw new MediaRepositoryError("Closed reason is required.", 422);
  return setAssignmentStatus(
    id,
    { type: "discover_admin", id: actorId },
    "incomplete_closed",
    {
      allowedFrom: ["assigned", "active", "submitted"],
      kind: "incomplete_closed",
      note,
      update: ", closed_reason = $3",
      values: [note],
    },
  );
}

export async function reopenAssignment(id: string, actorId: string, note?: string | null) {
  return setAssignmentStatus(
    id,
    { type: "discover_admin", id: actorId },
    "active",
    {
      allowedFrom: ["closed", "incomplete_closed"],
      kind: "reopened",
      note,
      update: ", delivered_at = NULL, closed_reason = NULL",
    },
  );
}

export async function reassignAssignment(
  id: string,
  actorId: string,
  mediaUserId: string,
) {
  return updateAssignment(id, { media_user_id: mediaUserId }, actorId);
}
