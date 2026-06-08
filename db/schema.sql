CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'team',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  organization TEXT NOT NULL DEFAULT '',
  source_category TEXT NOT NULL DEFAULT '',
  criteria_tags TEXT[] NOT NULL DEFAULT '{}',
  typical_fee TEXT NOT NULL DEFAULT '',
  registry_rank INTEGER,
  canonical_domain TEXT NOT NULL,
  seed_url TEXT NOT NULL DEFAULT '',
  credibility_tier INTEGER NOT NULL CHECK (credibility_tier BETWEEN 1 AND 3),
  status TEXT NOT NULL DEFAULT 'active',
  refresh_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sources ADD COLUMN IF NOT EXISTS seed_url TEXT NOT NULL DEFAULT '';
ALTER TABLE sources ADD COLUMN IF NOT EXISTS refresh_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS organization TEXT NOT NULL DEFAULT '';
ALTER TABLE sources ADD COLUMN IF NOT EXISTS source_category TEXT NOT NULL DEFAULT '';
ALTER TABLE sources ADD COLUMN IF NOT EXISTS criteria_tags TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE sources ADD COLUMN IF NOT EXISTS typical_fee TEXT NOT NULL DEFAULT '';
ALTER TABLE sources ADD COLUMN IF NOT EXISTS registry_rank INTEGER;

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  fee_amount NUMERIC(12,2),
  fee_currency TEXT NOT NULL DEFAULT 'USD',
  fee_purpose TEXT NOT NULL DEFAULT '',
  credibility_tier INTEGER NOT NULL CHECK (credibility_tier BETWEEN 1 AND 3),
  manual_status TEXT NOT NULL DEFAULT 'active',
  deadline DATE,
  criteria_tags TEXT[] NOT NULL DEFAULT '{}',
  keywords TEXT[] NOT NULL DEFAULT '{}',
  field TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  apply_url TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
  summary TEXT NOT NULL DEFAULT '',
  actionability INTEGER NOT NULL DEFAULT 3 CHECK (actionability BETWEEN 1 AND 5),
  extraction_confidence NUMERIC(5,2),
  last_seen_at TIMESTAMPTZ,
  content_hash TEXT,
  notes TEXT NOT NULL DEFAULT '',
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE events ADD COLUMN IF NOT EXISTS extraction_confidence NUMERIC(5,2);
ALTER TABLE events ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS content_hash TEXT;

CREATE TABLE IF NOT EXISTS source_pages (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  discovered_by TEXT NOT NULL DEFAULT 'manual',
  last_content_hash TEXT,
  last_fetched_at TIMESTAMPTZ,
  last_changed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_id, url)
);

ALTER TABLE source_pages ADD COLUMN IF NOT EXISTS discovered_by TEXT NOT NULL DEFAULT 'manual';

CREATE TABLE IF NOT EXISTS denylisted_domains (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  field TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  target_criteria TEXT[] NOT NULL DEFAULT '{}',
  covered_criteria TEXT[] NOT NULL DEFAULT '{}',
  keywords TEXT[] NOT NULL DEFAULT '{}',
  preferred_categories TEXT[] NOT NULL DEFAULT '{}',
  engagement_status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (engagement_status IN ('active', 'dormant', 'inactive', 'unknown')),
  engagement_as_of TIMESTAMPTZ,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE clients ADD COLUMN IF NOT EXISTS engagement_status TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS engagement_as_of TIMESTAMPTZ;
UPDATE clients
SET engagement_status = 'unknown'
WHERE engagement_status IS NULL;
ALTER TABLE clients ALTER COLUMN engagement_status SET DEFAULT 'unknown';
ALTER TABLE clients ALTER COLUMN engagement_status SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'clients_engagement_status_check'
  ) THEN
    ALTER TABLE clients
      ADD CONSTRAINT clients_engagement_status_check
      CHECK (engagement_status IN ('active', 'dormant', 'inactive', 'unknown'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS integration_sync_log (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  matched INTEGER NOT NULL DEFAULT 0,
  received INTEGER NOT NULL DEFAULT 0,
  error TEXT NOT NULL DEFAULT '',
  ran_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recommendations (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  score NUMERIC(5,2) NOT NULL,
  criterion_gap_score NUMERIC(5,2) NOT NULL,
  credibility_score NUMERIC(5,2) NOT NULL,
  keyword_score NUMERIC(5,2) NOT NULL,
  actionability_score NUMERIC(5,2) NOT NULL,
  location_score NUMERIC(5,2) NOT NULL,
  explanation JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, event_id)
);

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'tracking',
  applied_at TIMESTAMPTZ,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, event_id)
);

CREATE TABLE IF NOT EXISTS email_logs (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  provider_status TEXT NOT NULL,
  provider_message_id TEXT,
  sent_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ingestion_runs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'running',
  mode TEXT NOT NULL DEFAULT 'manual',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  pages_checked INTEGER NOT NULL DEFAULT 0,
  pages_changed INTEGER NOT NULL DEFAULT 0,
  events_upserted INTEGER NOT NULL DEFAULT 0,
  expired_purged INTEGER NOT NULL DEFAULT 0,
  low_confidence_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  error TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS ingestion_items (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES ingestion_runs(id) ON DELETE CASCADE,
  source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
  page_url TEXT NOT NULL,
  content_hash TEXT NOT NULL DEFAULT '',
  change_status TEXT NOT NULL DEFAULT 'unknown',
  extraction_status TEXT NOT NULL DEFAULT 'pending',
  confidence NUMERIC(5,2),
  event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
  summary TEXT NOT NULL DEFAULT '',
  error TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS review_items (
  id TEXT PRIMARY KEY,
  run_id TEXT REFERENCES ingestion_runs(id) ON DELETE SET NULL,
  event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
  source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
  page_url TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  confidence NUMERIC(5,2),
  status TEXT NOT NULL DEFAULT 'open',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_deadline ON events(deadline);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_lower_email ON clients((lower(email)));
CREATE INDEX IF NOT EXISTS idx_email_logs_client ON email_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_source_pages_source ON source_pages(source_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_items_run ON ingestion_items(run_id);
CREATE INDEX IF NOT EXISTS idx_review_items_status ON review_items(status);
