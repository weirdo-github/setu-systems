import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { normalizeCategory, stableEventId } from "@/lib/phase2-ingestion";
import { archiveEvent, updateReviewItemStatus, upsertEvent } from "@/lib/repository";
import type { ReviewItem } from "@/lib/types";

type ReviewPayload = {
  phase?: number;
  sourceId?: string;
  source_id?: string;
  sourceName?: string;
  source_name?: string;
  credibilityTier?: number;
  credibility_tier?: number;
  pageUrl?: string;
  page_url?: string;
  contentHash?: string;
  content_hash?: string;
  opportunity?: {
    title?: string;
    category?: string;
    feeAmount?: number | null;
    fee_amount?: number | null;
    feeCurrency?: string;
    fee_currency?: string;
    feePurpose?: string;
    fee_purpose?: string;
    deadline?: string | null;
    location?: string;
    field?: string;
    criteriaTags?: string[];
    criteria_tags?: string[];
    keywords?: string[];
    applyUrl?: string;
    apply_url?: string;
    sourceUrl?: string;
    source_url?: string;
    summary?: string;
    actionability?: number;
    confidence?: number;
  };
};

const validStatuses = new Set(["open", "approved", "rejected"]);
const retiredDemoUrlPattern = /(nationalsciencepress|globalinnovators|industryforumreview|localhost|127\.0\.0\.1)/i;

class ReviewItemError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

async function fetchReviewItem(id: string) {
  const rows = await query<ReviewItem>("SELECT * FROM review_items WHERE id = $1 LIMIT 1", [id]);
  return rows[0] ?? null;
}

async function sourceExists(sourceId: string) {
  const rows = await query<{ id: string }>("SELECT id FROM sources WHERE id = $1 LIMIT 1", [sourceId]);
  return Boolean(rows[0]);
}

function textField(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" || typeof value === "boolean") return String(value);
  }
  return "";
}

function numberField(record: Record<string, unknown>, fallback: number, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return fallback;
}

function nullableNumberField(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value === null) return null;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function textArrayField(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean);
    }
    if (typeof value === "string") {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function isRetiredDemoReview(...urls: string[]) {
  return urls.some((url) => retiredDemoUrlPattern.test(url));
}

async function approveReviewItem(item: ReviewItem) {
  const payload = item.payload as ReviewPayload;
  const payloadRecord = payload as Record<string, unknown>;
  const opportunity = (payload.opportunity ?? {}) as Record<string, unknown>;
  const title = textField(opportunity, "title") || item.title.trim();
  if (!title) {
    throw new ReviewItemError("Review item is missing an opportunity title.", 422);
  }

  const pageUrl = textField(payloadRecord, "pageUrl", "page_url") || item.page_url;
  const sourceUrl = textField(opportunity, "sourceUrl", "source_url") || pageUrl;
  if (isRetiredDemoReview(pageUrl, sourceUrl)) {
    throw new ReviewItemError("This review item is from retired demo data and cannot be approved into active inventory.", 422);
  }

  let sourceId = textField(payloadRecord, "sourceId", "source_id") || item.source_id || "";
  if (sourceId && !(await sourceExists(sourceId))) {
    sourceId = "";
  }
  const eventId = item.event_id ?? stableEventId(sourceId, title, sourceUrl);
  const sourceName = textField(payloadRecord, "sourceName", "source_name");

  return upsertEvent(
    {
      title,
      category: normalizeCategory(textField(opportunity, "category")),
      fee_amount: nullableNumberField(opportunity, "feeAmount", "fee_amount"),
      fee_currency: textField(opportunity, "feeCurrency", "fee_currency") || "USD",
      fee_purpose: textField(opportunity, "feePurpose", "fee_purpose"),
      credibility_tier: numberField(payloadRecord, 2, "credibilityTier", "credibility_tier"),
      manual_status: "active",
      deadline: textField(opportunity, "deadline") || null,
      criteria_tags: textArrayField(opportunity, "criteriaTags", "criteria_tags"),
      keywords: textArrayField(opportunity, "keywords"),
      field: textField(opportunity, "field"),
      location: textField(opportunity, "location"),
      apply_url: textField(opportunity, "applyUrl", "apply_url"),
      source_url: sourceUrl,
      source_id: sourceId || null,
      summary: textField(opportunity, "summary"),
      actionability: numberField(opportunity, 3, "actionability"),
      extraction_confidence: nullableNumberField(opportunity, "confidence"),
      last_seen_at: new Date().toISOString(),
      content_hash: textField(payloadRecord, "contentHash", "content_hash") || null,
      notes: `Approved from review queue${sourceName ? ` (${sourceName})` : ""}.`,
      archived: false,
    },
    eventId,
  );
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { response } = await requireUser();
  if (response) return response;

  try {
    const { id } = await context.params;
    const payload = await request.json();
    const status = String(payload.status ?? "open");
    if (!validStatuses.has(status)) {
      return NextResponse.json({ error: "Unsupported review status." }, { status: 400 });
    }

    const item = await fetchReviewItem(id);
    if (!item) return NextResponse.json({ error: "Review item not found" }, { status: 404 });

    let event = null;
    if (status === "approved") {
      event = await approveReviewItem(item);
    }

    if (status === "rejected" && item.event_id) {
      await archiveEvent(item.event_id);
    }

    const reviewItem = await updateReviewItemStatus(id, status);
    return NextResponse.json({ reviewItem, event });
  } catch (error) {
    if (error instanceof ReviewItemError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Review item update failed", error);
    return NextResponse.json({ error: "Review item update failed." }, { status: 500 });
  }
}
