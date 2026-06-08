import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import pg from "pg";

const { Pool } = pg;

let databaseUrl =
  process.env.DATABASE_URL || "postgres://discover:discover@localhost:5435/discover";
const localPassword = "discover123";

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
  databaseUrl = process.env.DATABASE_URL || databaseUrl;
}

function id(prefix) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const key = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${key}`;
}

async function waitForDb(pool, attempts = 30) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch (error) {
      if (i === attempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

async function loadSourceRegistry() {
  const registryPath = path.join(process.cwd(), "data/source-registry.json");
  return JSON.parse(await readFile(registryPath, "utf8"));
}

const retiredFixtureSourceIds = [
  "src_natpress",
  "src_global_awards",
  "src_industry_forum",
];

const retiredFixtureEventIds = [
  "evt_research_press_profile",
  "evt_innovation_awards",
  "evt_judging_panel",
  "evt_speaking_summit",
];

const standingOpportunityRanks = new Set([
  1, 5, 9, 10, 15, 16, 18, 19, 20, 21, 26, 27, 28, 34, 38, 40, 41, 43, 44, 45,
]);

function eventIdForStandingSource(source) {
  return `evt_standing_${source.id.replace(/^src_/, "")}`;
}

function actionabilityForSource(source) {
  const text = `${source.name} ${source.seed_url} ${source.notes}`.toLowerCase();
  if (/apply|submit|submission|nominate|nomination|volunteer|pitch|contribute/.test(text)) {
    return 5;
  }
  return 4;
}

function keywordsForSource(source) {
  return [
    source.organization,
    source.source_category,
    ...source.criteria_tags,
    ...source.name.split(/[^A-Za-z0-9]+/).filter((item) => item.length > 2),
  ].filter(Boolean);
}

const seedClients = [
  {
    id: "cli_anika",
    name: "Anika Rao",
    email: "anika@example.com",
    field: "Artificial intelligence",
    location: "United States",
    target_criteria: [
      "Awards",
      "Published Material",
      "Judging",
      "Original Contributions",
      "Leading/Critical Role",
    ],
    covered_criteria: ["Original Contributions", "Leading/Critical Role"],
    keywords: ["AI safety", "research", "startup", "product"],
    preferred_categories: ["Awards & Nominations", "Media & Interview", "Judging", "Authorship"],
    notes: "Strong research record; needs external press and judging proof.",
  },
  {
    id: "cli_marcus",
    name: "Marcus Lee",
    email: "marcus@example.com",
    field: "Cloud infrastructure",
    location: "Chicago, IL",
    target_criteria: [
      "Published Material",
      "Judging",
      "Original Contributions",
      "Leading/Critical Role",
    ],
    covered_criteria: ["Published Material"],
    keywords: ["cloud", "platform", "infrastructure", "reliability"],
    preferred_categories: ["Speaking", "Judging", "Media & Interview", "Authorship"],
    notes: "Needs leadership-facing opportunities that connect platform work to industry impact.",
  },
];

async function main() {
  loadLocalEnv();
  const pool = new Pool({ connectionString: databaseUrl });
  await waitForDb(pool);
  const schema = await readFile(path.join(process.cwd(), "db/schema.sql"), "utf8");
  await pool.query(schema);

  const users = [
    {
      id: "usr_admin",
      name: "Discover Admin",
      email: "admin@discover.local",
      role: "admin",
    },
    {
      id: "usr_team",
      name: "Discover Team Member",
      email: "teammate@discover.local",
      role: "team",
    },
  ];

  for (const user of users) {
    await pool.query(
      `INSERT INTO users (id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         email = EXCLUDED.email,
         password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role`,
      [user.id, user.name, user.email, hashPassword(localPassword), user.role],
    );
  }

  const sourceRegistry = await loadSourceRegistry();
  const registryIds = sourceRegistry.map((source) => source.id);

  for (const source of sourceRegistry) {
    await pool.query(
      `INSERT INTO sources (
         id, name, organization, source_category, criteria_tags, typical_fee,
         registry_rank, canonical_domain, seed_url, credibility_tier, notes,
         status, refresh_enabled
       )
       VALUES ($1, $2, $3, $4, $5::text[], $6, $7, $8, $9, $10, $11, 'active', TRUE)
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
         notes = EXCLUDED.notes,
         status = 'active',
         refresh_enabled = TRUE,
         updated_at = now()`,
      [
        source.id,
        source.name,
        source.organization,
        source.source_category,
        source.criteria_tags,
        source.typical_fee,
        source.registry_rank,
        source.canonical_domain,
        source.seed_url,
        source.credibility_tier,
        source.notes,
      ],
    );

    await pool.query(
      `INSERT INTO source_pages (id, source_id, url, label)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (source_id, url) DO UPDATE SET
         label = EXCLUDED.label,
         status = 'active',
         updated_at = now()`,
      [`pg_${source.id.replace("src_", "")}`, source.id, source.seed_url, "Registry seed page"],
    );
  }

  await pool.query(
    `UPDATE sources
     SET status = 'inactive', refresh_enabled = FALSE, updated_at = now()
     WHERE id <> ALL($1::text[])`,
    [registryIds],
  );

  await pool.query(
    `UPDATE source_pages
     SET status = 'inactive', updated_at = now()
     WHERE source_id <> ALL($1::text[])`,
    [registryIds],
  );

  await pool.query(
    `UPDATE events
     SET manual_status = 'inactive',
         archived = TRUE,
         notes = trim(concat(notes, ' Archived by registry setup: local demo fixture, not a real client-apply opportunity.')),
         updated_at = now()
     WHERE id = ANY($1::text[])
        OR source_id = ANY($2::text[])
        OR source_url ~* '(nationalsciencepress|globalinnovators|industryforumreview|localhost|127\\.0\\.0\\.1)'
        OR apply_url ~* '(nationalsciencepress|globalinnovators|industryforumreview|localhost|127\\.0\\.0\\.1)'`,
    [retiredFixtureEventIds, retiredFixtureSourceIds],
  );

  await pool.query(
    `UPDATE review_items
     SET status = 'rejected',
         reason = trim(concat(reason, ' Retired by registry setup: demo source is not eligible for active inventory.')),
         updated_at = now()
     WHERE status = 'open'
       AND (
         source_id = ANY($1::text[])
         OR payload->>'sourceId' = ANY($1::text[])
         OR payload->>'source_id' = ANY($1::text[])
         OR page_url ~* '(nationalsciencepress|globalinnovators|industryforumreview|localhost|127\\.0\\.0\\.1)'
         OR COALESCE(payload->>'pageUrl', '') ~* '(nationalsciencepress|globalinnovators|industryforumreview|localhost|127\\.0\\.0\\.1)'
         OR COALESCE(payload->>'page_url', '') ~* '(nationalsciencepress|globalinnovators|industryforumreview|localhost|127\\.0\\.0\\.1)'
         OR COALESCE(payload #>> '{opportunity,sourceUrl}', '') ~* '(nationalsciencepress|globalinnovators|industryforumreview|localhost|127\\.0\\.0\\.1)'
         OR COALESCE(payload #>> '{opportunity,source_url}', '') ~* '(nationalsciencepress|globalinnovators|industryforumreview|localhost|127\\.0\\.0\\.1)'
       )`,
    [retiredFixtureSourceIds],
  );

  await pool.query("DELETE FROM source_pages WHERE source_id <> ALL($1::text[])", [registryIds]);
  await pool.query("DELETE FROM sources WHERE id <> ALL($1::text[])", [registryIds]);

  for (const source of sourceRegistry.filter((item) => standingOpportunityRanks.has(item.registry_rank))) {
    await pool.query(
      `INSERT INTO events (
         id, title, category, fee_amount, fee_purpose, credibility_tier, deadline,
         criteria_tags, keywords, field, location, apply_url, source_url, source_id,
         summary, actionability, manual_status, notes, archived
       )
       VALUES ($1, $2, $3, $4, $5, $6, NULL, $7::text[], $8::text[], $9, $10, $11, $12, $13, $14, $15, 'active', $16, FALSE)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         category = EXCLUDED.category,
         fee_amount = EXCLUDED.fee_amount,
         fee_purpose = EXCLUDED.fee_purpose,
         credibility_tier = EXCLUDED.credibility_tier,
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
         manual_status = 'active',
         notes = EXCLUDED.notes,
         archived = FALSE,
         updated_at = now()`,
      [
        eventIdForStandingSource(source),
        source.name,
        source.source_category,
        /^free$/i.test(source.typical_fee) ? 0 : null,
        source.typical_fee,
        source.credibility_tier,
        source.criteria_tags,
        keywordsForSource(source),
        source.source_category,
        "Remote / source-specific",
        source.seed_url,
        source.seed_url,
        source.id,
        `${source.organization} standing profile-building path. ${source.notes}`,
        actionabilityForSource(source),
        "Verified standing opportunity from the EB-1A master source registry. Confirm current eligibility and cycle timing before client submission.",
      ],
    );
  }

  for (const client of seedClients) {
    await pool.query(
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
         updated_at = now()`,
      [
        client.id,
        client.name,
        client.email,
        client.field,
        client.location,
        client.target_criteria,
        client.covered_criteria,
        client.keywords,
        client.preferred_categories,
        client.notes,
      ],
    );
  }

  await pool.end();
  console.log(`Discover database ready (${id("setup")}).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
