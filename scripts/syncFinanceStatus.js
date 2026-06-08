import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";

const { Pool } = pg;
const allowedStatuses = new Set(["active", "dormant", "inactive", "unknown"]);

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const body = readFileSync(filePath, "utf8");

  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

function loadLocalEnv() {
  loadEnvFile(path.join(process.cwd(), ".env.local"));
  loadEnvFile(path.join(process.cwd(), ".env"));
}

function normalizeStatus(value) {
  const status = String(value ?? "").trim().toLowerCase();
  if (!allowedStatuses.has(status)) {
    throw new Error(`finance status sync received unsupported engagement_status: ${value}`);
  }
  return status;
}

function emailsForCustomer(customer) {
  const aliases = Array.isArray(customer.aliases) ? customer.aliases : [];
  return [customer.email, ...aliases]
    .map((email) => String(email ?? "").trim().toLowerCase())
    .filter(Boolean);
}

async function logSync(pool, payload) {
  await pool.query(
    `INSERT INTO integration_sync_log(source, matched, received, error, ran_at)
     VALUES ($1, $2, $3, $4, now())`,
    [payload.source, payload.matched, payload.received, payload.error ?? ""],
  );
}

async function runSync() {
  loadLocalEnv();

  const financeBaseUrl = process.env.FINANCE_BASE_URL;
  const integrationKey = process.env.FINANCE_INTEGRATION_KEY;
  const databaseUrl =
    process.env.DATABASE_URL || "postgres://discover:discover@localhost:5435/discover";

  if (!financeBaseUrl) throw new Error("FINANCE_BASE_URL is required");
  if (!integrationKey) throw new Error("FINANCE_INTEGRATION_KEY is required");

  const pool = new Pool({ connectionString: databaseUrl });
  let received = 0;
  let matched = 0;

  try {
    const url = `${financeBaseUrl.replace(/\/$/, "")}/api/integration/engagement-status`;
    const response = await fetch(url, {
      headers: { "X-Api-Key": integrationKey },
    });

    if (!response.ok) {
      throw new Error(`finance status sync failed: ${response.status}`);
    }

    const payload = await response.json();
    const customers = Array.isArray(payload.customers) ? payload.customers : [];
    received = customers.length;

    for (const customer of customers) {
      const emails = emailsForCustomer(customer);
      if (!emails.length) continue;

      const status = normalizeStatus(customer.engagement_status);
      const asOf = customer.as_of || payload.as_of || new Date().toISOString();
      const result = await pool.query(
        `UPDATE clients
         SET engagement_status = $1,
             engagement_as_of = $2,
             updated_at = now()
         WHERE lower(email) = ANY($3::text[])`,
        [status, asOf, emails],
      );
      matched += result.rowCount ?? 0;
    }

    await logSync(pool, { source: "finance", matched, received });
    return { matched, received };
  } catch (error) {
    await logSync(pool, {
      source: "finance",
      matched,
      received,
      error: error instanceof Error ? error.message : String(error),
    }).catch(() => undefined);
    throw error;
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSync()
    .then((summary) => {
      console.log(JSON.stringify({ source: "finance", ...summary }));
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
}

export { emailsForCustomer, normalizeStatus, runSync };
