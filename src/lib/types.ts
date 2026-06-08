export type User = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "team";
};

export type Source = {
  id: string;
  name: string;
  organization: string;
  source_category: string;
  criteria_tags: string[];
  typical_fee: string;
  registry_rank: number | null;
  canonical_domain: string;
  seed_url: string;
  credibility_tier: number;
  status: string;
  refresh_enabled: boolean;
  notes: string;
};

export type SourcePage = {
  id: string;
  source_id: string;
  source_name?: string | null;
  url: string;
  label: string;
  status: string;
  discovered_by: string;
  last_content_hash: string | null;
  last_fetched_at: string | null;
  last_changed_at: string | null;
};

export type EventRecord = {
  id: string;
  title: string;
  category: string;
  fee_amount: string | null;
  fee_currency: string;
  fee_purpose: string;
  credibility_tier: number;
  manual_status: string;
  derived_status: string;
  deadline: string | null;
  criteria_tags: string[];
  keywords: string[];
  field: string;
  location: string;
  apply_url: string;
  source_url: string;
  source_id: string | null;
  source_name?: string | null;
  summary: string;
  actionability: number;
  extraction_confidence: string | null;
  last_seen_at: string | null;
  content_hash: string | null;
  notes: string;
  archived: boolean;
  created_at?: string;
  updated_at?: string;
};

export type EngagementStatus = "active" | "dormant" | "inactive" | "unknown";

export type ClientRecord = {
  id: string;
  name: string;
  email: string;
  field: string;
  location: string;
  target_criteria: string[];
  covered_criteria: string[];
  keywords: string[];
  preferred_categories: string[];
  notes: string;
  engagement_status: EngagementStatus;
  engagement_as_of: string | null;
  created_at?: string;
  updated_at?: string;
};

export type EmailLog = {
  id: string;
  client_id: string;
  event_id: string | null;
  to_email: string;
  subject: string;
  body: string;
  provider_status: string;
  provider_message_id: string | null;
  sent_by: string | null;
  created_at: string;
  client_name?: string | null;
  event_title?: string | null;
};

export type IngestionRun = {
  id: string;
  status: string;
  mode: string;
  started_at: string;
  finished_at: string | null;
  pages_checked: number;
  pages_changed: number;
  events_upserted: number;
  expired_purged: number;
  low_confidence_count: number;
  notes: string;
  error: string;
};

export type IngestionItem = {
  id: string;
  run_id: string;
  source_id: string | null;
  page_url: string;
  content_hash: string;
  change_status: string;
  extraction_status: string;
  confidence: string | null;
  event_id: string | null;
  summary: string;
  error: string;
  created_at: string;
};

export type ReviewItem = {
  id: string;
  run_id: string | null;
  event_id: string | null;
  source_id: string | null;
  source_name?: string | null;
  page_url: string;
  title: string;
  reason: string;
  confidence: string | null;
  status: string;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type MatchBreakdown = {
  criterionGap: number;
  credibility: number;
  keyword: number;
  semantic: number;
  actionability: number;
  location: number;
  total: number;
  missingCriteria: string[];
  matchedKeywords: string[];
  flags: string[];
};

export type MatchRecord = {
  event: EventRecord;
  score: number;
  breakdown: MatchBreakdown;
};
