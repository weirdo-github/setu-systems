import crypto from "node:crypto";
import { query } from "@/lib/db";
import { EVENT_CATEGORIES } from "@/lib/constants";
import { isPushableClient } from "@/lib/engagement";
import { rankMatches } from "@/lib/matching";
import {
  createIngestionItem,
  createIngestionRun,
  createReviewItem,
  listClients,
  listEvents,
  logRecommendation,
  purgeExpiredEvents,
  updateIngestionRun,
  updateSourcePageHash,
  upsertEvent,
} from "@/lib/repository";
import type { SourcePage } from "@/lib/types";

export type RegistryPage = SourcePage & {
  source_name: string;
  canonical_domain: string;
  credibility_tier: number;
  refresh_enabled: boolean;
  source_status: string;
};

export type ExtractedOpportunity = {
  title: string;
  category: string;
  feeAmount: number | null;
  feeCurrency: string;
  feePurpose: string;
  deadline: string | null;
  location: string;
  field: string;
  criteriaTags: string[];
  keywords: string[];
  applyUrl: string;
  sourceUrl: string;
  summary: string;
  actionability: number;
  confidence: number;
};

export type GuardResult =
  | { allowed: true; reason: string }
  | { allowed: false; reason: string };

export type OpportunityValidation =
  | { valid: true; reason: string; opportunity: ExtractedOpportunity }
  | { valid: false; reason: string; opportunity: ExtractedOpportunity };

export const lowConfidenceThreshold = 0.74;

export function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function stableEventId(sourceId: string, title: string, sourceUrl: string) {
  return `evt_auto_${sha256(`${sourceId}:${title}:${sourceUrl}`).slice(0, 18)}`;
}

export function normalizeDomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
}

function urlHost(value: string) {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isLocalFixture(url: URL) {
  return ["localhost", "127.0.0.1", "::1"].includes(url.hostname) && url.pathname.startsWith("/phase2-fixtures/");
}

function absoluteUrl(value: string, baseUrl: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return "";
  }
}

function isPublicHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol) && !isLocalFixture(parsed);
  } catch {
    return false;
  }
}

function isOnCanonicalDomain(value: string, page: RegistryPage) {
  const canonical = normalizeDomain(page.canonical_domain);
  const host = urlHost(value);
  return Boolean(host && canonical && (host === canonical || host.endsWith(`.${canonical}`)));
}

function hasClientActionSignal(opportunity: ExtractedOpportunity, page: RegistryPage) {
  const text = [
    opportunity.title,
    opportunity.summary,
    opportunity.applyUrl,
    opportunity.sourceUrl,
    opportunity.category,
    page.url,
  ]
    .join(" ")
    .toLowerCase();

  return /apply|application|submit|submission|submissions|nominate|nomination|call for|cfp|proposal|proposals|speaker|speakers|reviewer|reviewers|volunteer|pitch|contribute|author guidelines|become|join|membership|senior member|fellow|award|prize|participate|opportunit/.test(text);
}

async function reachableClientLink(url: string, page: RegistryPage) {
  const headers = { "User-Agent": "Discover-LinkVerifier/0.1" };

  for (const method of ["HEAD", "GET"] as const) {
    try {
      const response = await fetch(url, {
        method,
        headers,
        redirect: "follow",
        signal: AbortSignal.timeout(7000),
      });
      const finalUrl = response.url || url;

      if (!isOnCanonicalDomain(finalUrl, page)) {
        return {
          ok: false,
          reason: `client link redirects outside ${page.canonical_domain}`,
          finalUrl,
        };
      }

      if (response.ok) {
        return { ok: true, reason: "client link reached", finalUrl };
      }

      if (method === "HEAD" && [403, 405].includes(response.status)) {
        continue;
      }

      return {
        ok: false,
        reason: `client link returned ${response.status}`,
        finalUrl,
      };
    } catch (error) {
      if (method === "GET") {
        return {
          ok: false,
          reason: error instanceof Error ? error.message : "client link fetch failed",
          finalUrl: url,
        };
      }
    }
  }

  return { ok: false, reason: "client link fetch failed", finalUrl: url };
}

export async function validateClientOpportunity(
  opportunity: ExtractedOpportunity,
  page: RegistryPage,
): Promise<OpportunityValidation> {
  const sourceUrl = absoluteUrl(opportunity.sourceUrl || page.url, page.url);
  const applyUrl = absoluteUrl(opportunity.applyUrl || opportunity.sourceUrl || page.url, page.url);
  const normalized = {
    ...opportunity,
    applyUrl,
    sourceUrl,
    category: normalizeCategory(opportunity.category || page.source_name),
  };

  if (!normalized.title.trim()) {
    return { valid: false, reason: "missing opportunity title", opportunity: normalized };
  }

  if (!normalized.summary.trim()) {
    return { valid: false, reason: "missing opportunity summary", opportunity: normalized };
  }

  if (!isPublicHttpUrl(applyUrl)) {
    return { valid: false, reason: "missing public client application link", opportunity: normalized };
  }

  if (!isPublicHttpUrl(sourceUrl)) {
    return { valid: false, reason: "missing public source link", opportunity: normalized };
  }

  if (!isOnCanonicalDomain(applyUrl, page) || !isOnCanonicalDomain(sourceUrl, page)) {
    return {
      valid: false,
      reason: `link is outside canonical source domain ${page.canonical_domain}`,
      opportunity: normalized,
    };
  }

  if (!hasClientActionSignal(normalized, page)) {
    return {
      valid: false,
      reason: "missing client-facing apply, nominate, submit, pitch, reviewer, or membership signal",
      opportunity: normalized,
    };
  }

  const reachable = await reachableClientLink(applyUrl, page);
  if (!reachable.ok) {
    return { valid: false, reason: reachable.reason, opportunity: normalized };
  }

  return {
    valid: true,
    reason: reachable.reason,
    opportunity: {
      ...normalized,
      applyUrl: reachable.finalUrl,
    },
  };
}

export async function guardedFetch(page: RegistryPage): Promise<{
  html: string;
  guard: GuardResult;
}> {
  const parsed = new URL(page.url);
  const canonical = normalizeDomain(page.canonical_domain);
  const host = urlHost(page.url);
  const denylist = await query<{ domain: string }>("SELECT domain FROM denylisted_domains");
  const denied = denylist.some((item) => {
    const deniedDomain = normalizeDomain(item.domain);
    return host === deniedDomain || host.endsWith(`.${deniedDomain}`);
  });

  if (denied) {
    return { html: "", guard: { allowed: false, reason: `${host} is denylisted` } };
  }

  const matchesCanonical = host === canonical || host.endsWith(`.${canonical}`);
  const localFixture = isLocalFixture(parsed);

  if (!matchesCanonical && !localFixture) {
    return {
      html: "",
      guard: {
        allowed: false,
        reason: `${host} is outside canonical domain ${canonical}`,
      },
    };
  }

  const response = await fetch(page.url, {
    headers: { "User-Agent": "Discover-Phase2/0.1" },
  });

  if (!response.ok) {
    return {
      html: "",
      guard: {
        allowed: false,
        reason: `fetch returned ${response.status}`,
      },
    };
  }

  return {
    html: await response.text(),
    guard: {
      allowed: true,
      reason: localFixture ? "local review fixture" : `canonical domain ${canonical}`,
    },
  };
}

export function cleanHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function textFromHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value: string) {
  return textFromHtml(value);
}

function splitList(value: string) {
  return value
    .split(/[,;|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseFee(value: string) {
  const amountMatch = value.match(/(?:usd|\$)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i);
  const amount = amountMatch ? Number(amountMatch[1].replaceAll(",", "")) : null;
  const currency = /eur/i.test(value) ? "EUR" : /gbp/i.test(value) ? "GBP" : "USD";
  const purpose = value
    .replace(/usd|\$|eur|gbp/gi, "")
    .replace(/[0-9,.]+/g, "")
    .trim();

  return {
    amount,
    currency,
    purpose,
  };
}

const categoryAliases: Record<string, string> = {
  article: "Authorship",
  articles: "Authorship",
  authorship: "Authorship",
  publication: "Authorship",
  publications: "Authorship",
  "published material": "Media & Interview",
  press: "Media & Interview",
  media: "Media & Interview",
  interview: "Media & Interview",
  interviews: "Media & Interview",
  award: "Awards & Nominations",
  awards: "Awards & Nominations",
  nomination: "Awards & Nominations",
  nominations: "Awards & Nominations",
  membership: "Memberships & Fellowships",
  memberships: "Memberships & Fellowships",
  fellowship: "Memberships & Fellowships",
  fellowships: "Memberships & Fellowships",
  board: "Editorial / Board / Leadership",
  editorial: "Editorial / Board / Leadership",
  leadership: "Editorial / Board / Leadership",
  exhibition: "Exhibitions & Showcases",
  exhibitions: "Exhibitions & Showcases",
  showcase: "Exhibitions & Showcases",
  showcases: "Exhibitions & Showcases",
};

export function normalizeCategory(value: string) {
  const normalized = value.trim().toLowerCase();
  const alias = categoryAliases[normalized];
  if (alias) return alias;

  const category = EVENT_CATEGORIES.find((item) => item.toLowerCase() === normalized);
  return category ?? "Authorship";
}

function normalizeDeadline(value: string) {
  const trimmed = value.trim();
  if (!trimmed || /rolling/i.test(trimmed)) return null;
  const parsed = new Date(`${trimmed}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function articleBlocks(html: string) {
  const blocks = [...html.matchAll(/<article\b[^>]*data-opportunity[^>]*>([\s\S]*?)<\/article>/gi)].map(
    (match) => match[1],
  );
  return blocks.length ? blocks : [html];
}

function dlMap(html: string) {
  const entries = [...html.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi)];
  const map = new Map<string, string>();
  for (const [, key, value] of entries) {
    map.set(stripTags(key).toLowerCase(), stripTags(value));
  }
  return map;
}

function h1Text(html: string) {
  return stripTags(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
}

function summaryText(html: string) {
  const paragraph = html.match(/<p[^>]*class=["'][^"']*summary[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1];
  return stripTags(paragraph ?? "");
}

export function ruleBasedExtract(html: string): ExtractedOpportunity[] {
  return articleBlocks(html)
    .map((block) => {
      const map = dlMap(block);
      const fee = parseFee(map.get("fee") ?? "");
      const title = h1Text(block);
      const category = normalizeCategory(map.get("category") ?? "");
      const criteriaTags = splitList(map.get("criteria") ?? "");
      const keywords = splitList(map.get("keywords") ?? "");
      const sourceUrl = map.get("source") ?? "";
      const applyUrl = map.get("apply") ?? "";
      const summary = summaryText(block);
      const confidence =
        title && summary && sourceUrl && applyUrl && criteriaTags.length
          ? 0.9
          : title && summary
            ? 0.62
            : 0.3;

      return {
        title,
        category,
        feeAmount: fee.amount,
        feeCurrency: fee.currency,
        feePurpose: fee.purpose,
        deadline: normalizeDeadline(map.get("deadline") ?? ""),
        location: map.get("location") ?? "",
        field: map.get("field") ?? "",
        criteriaTags,
        keywords,
        applyUrl,
        sourceUrl,
        summary,
        actionability: applyUrl ? 4 : 2,
        confidence,
      };
    })
    .filter((item) => item.title);
}

async function extractWithOpenAI(cleanedText: string): Promise<ExtractedOpportunity[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_EXTRACTION_MODEL || "gpt-4o-mini",
      input: [
        {
          role: "system",
          content:
            "Extract profile-building opportunities. Return only opportunities that appear in the source text. If the page is unrelated, return an empty opportunities array.",
        },
        {
          role: "user",
          content: cleanedText.slice(0, 18_000),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "discover_opportunities",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["opportunities"],
            properties: {
              opportunities: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: [
                    "title",
                    "category",
                    "feeAmount",
                    "feeCurrency",
                    "feePurpose",
                    "deadline",
                    "location",
                    "field",
                    "criteriaTags",
                    "keywords",
                    "applyUrl",
                    "sourceUrl",
                    "summary",
                    "actionability",
                    "confidence",
                  ],
                  properties: {
                    title: { type: "string" },
                    category: { type: "string" },
                    feeAmount: { type: ["number", "null"] },
                    feeCurrency: { type: "string" },
                    feePurpose: { type: "string" },
                    deadline: { type: ["string", "null"] },
                    location: { type: "string" },
                    field: { type: "string" },
                    criteriaTags: { type: "array", items: { type: "string" } },
                    keywords: { type: "array", items: { type: "string" } },
                    applyUrl: { type: "string" },
                    sourceUrl: { type: "string" },
                    summary: { type: "string" },
                    actionability: { type: "number" },
                    confidence: { type: "number" },
                  },
                },
              },
            },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI extraction failed: ${response.status}`);
  }

  const json = (await response.json()) as { output_text?: string; output?: unknown[] };
  const text =
    json.output_text ??
    JSON.stringify(json.output ?? "")
      .match(/\{[\s\S]*\}/)?.[0] ??
    "";

  if (!text) return null;
  const parsed = JSON.parse(text) as { opportunities?: ExtractedOpportunity[] };
  return parsed.opportunities ?? [];
}

export async function extractOpportunities(html: string) {
  const cleaned = cleanHtml(html);
  if (process.env.OPENAI_API_KEY) {
    try {
      const openaiResult = await extractWithOpenAI(textFromHtml(cleaned));
      if (openaiResult) return openaiResult;
    } catch {
      // Rule extraction is the deterministic fallback for local review and transient model errors.
    }
  }
  return ruleBasedExtract(html);
}

export async function registryPages() {
  return query<RegistryPage>(
    `SELECT
       source_pages.*,
       sources.name AS source_name,
       sources.canonical_domain,
       sources.credibility_tier,
       sources.refresh_enabled,
       sources.status AS source_status
     FROM source_pages
     JOIN sources ON sources.id = source_pages.source_id
     WHERE source_pages.status = 'active'
       AND sources.status = 'active'
       AND sources.refresh_enabled = TRUE
     ORDER BY sources.credibility_tier ASC, sources.name ASC`,
  );
}

export async function runPhase2Ingestion(mode = "manual") {
  const run = await createIngestionRun(mode);
  let pagesChecked = 0;
  let pagesChanged = 0;
  let eventsUpserted = 0;
  let lowConfidenceCount = 0;

  try {
    const pages = await registryPages();

    for (const page of pages) {
      pagesChecked += 1;
      const fetched = await guardedFetch(page);

      if (!fetched.guard.allowed) {
        await createIngestionItem({
          runId: run.id,
          sourceId: page.source_id,
          pageUrl: page.url,
          changeStatus: "blocked",
          extractionStatus: "skipped",
          error: fetched.guard.reason,
        });
        continue;
      }

      const cleaned = cleanHtml(fetched.html);
      const hash = sha256(cleaned);
      const changed = hash !== page.last_content_hash;
      await updateSourcePageHash(page.id, hash, changed);

      if (!changed) {
        await createIngestionItem({
          runId: run.id,
          sourceId: page.source_id,
          pageUrl: page.url,
          contentHash: hash,
          changeStatus: "unchanged",
          extractionStatus: "skipped",
          summary: "Content hash unchanged.",
        });
        continue;
      }

      pagesChanged += 1;
      const opportunities = await extractOpportunities(fetched.html);

      if (!opportunities.length) {
        await createIngestionItem({
          runId: run.id,
          sourceId: page.source_id,
          pageUrl: page.url,
          contentHash: hash,
          changeStatus: "changed",
          extractionStatus: "empty",
          summary: "No opportunities extracted.",
        });
        continue;
      }

      for (const extractedOpportunity of opportunities) {
        const validation = await validateClientOpportunity(extractedOpportunity, page);
        if (!validation.valid) {
          lowConfidenceCount += 1;
          await createIngestionItem({
            runId: run.id,
            sourceId: page.source_id,
            pageUrl: page.url,
            contentHash: hash,
            changeStatus: "changed",
            extractionStatus: "rejected",
            confidence: validation.opportunity.confidence,
            summary: `Not client-ready: ${validation.reason}`,
            error: validation.reason,
          });
          await createReviewItem({
            runId: run.id,
            sourceId: page.source_id,
            pageUrl: page.url,
            title: validation.opportunity.title || page.source_name,
            reason: `Client-link verification failed: ${validation.reason}`,
            confidence: validation.opportunity.confidence,
            payload: {
              opportunity: validation.opportunity,
              validation: {
                reason: validation.reason,
                sourceName: page.source_name,
                canonicalDomain: page.canonical_domain,
              },
            },
          });
          continue;
        }

        const opportunity = validation.opportunity;
        const eventId = stableEventId(
          page.source_id,
          opportunity.title,
          opportunity.sourceUrl || page.url,
        );
        const event = await upsertEvent(
          {
            title: opportunity.title,
            category: normalizeCategory(opportunity.category),
            fee_amount: opportunity.feeAmount,
            fee_currency: opportunity.feeCurrency || "USD",
            fee_purpose: opportunity.feePurpose,
            credibility_tier: page.credibility_tier,
            manual_status: "active",
            deadline: opportunity.deadline,
            criteria_tags: opportunity.criteriaTags,
            keywords: opportunity.keywords,
            field: opportunity.field,
            location: opportunity.location,
            apply_url: opportunity.applyUrl,
            source_url: opportunity.sourceUrl || page.url,
            source_id: page.source_id,
            summary: opportunity.summary,
            actionability: opportunity.actionability,
            extraction_confidence: opportunity.confidence,
            last_seen_at: new Date().toISOString(),
            content_hash: hash,
            notes: `Phase 2 ingestion from ${page.source_name}.`,
            archived: false,
          },
          eventId,
        );

        eventsUpserted += 1;
        await createIngestionItem({
          runId: run.id,
          sourceId: page.source_id,
          pageUrl: page.url,
          contentHash: hash,
          changeStatus: "changed",
          extractionStatus: "upserted",
          confidence: opportunity.confidence,
          eventId: event.id,
          summary: opportunity.summary,
        });

        const needsReview =
          opportunity.confidence < lowConfidenceThreshold ||
          (Number(opportunity.feeAmount ?? 0) > 0 && page.credibility_tier === 3);

        if (needsReview) {
          lowConfidenceCount += 1;
          await createReviewItem({
            runId: run.id,
            eventId: event.id,
            sourceId: page.source_id,
            pageUrl: page.url,
            title: opportunity.title,
            reason:
              opportunity.confidence < lowConfidenceThreshold
                ? "Low extraction confidence"
                : "Pay-to-play rule triggered",
            confidence: opportunity.confidence,
            payload: opportunity as unknown as Record<string, unknown>,
          });
        }
      }
    }

    const expiredPurged = await purgeExpiredEvents();
    const [clients, events] = await Promise.all([listClients(), listEvents()]);
    const pushableClients = clients.filter(isPushableClient);
    await Promise.all(
      pushableClients.flatMap((client) =>
        rankMatches(client, events)
          .slice(0, 8)
          .map((match) =>
            logRecommendation(client.id, match.event.id, match.score, match.breakdown),
          ),
      ),
    );

    return updateIngestionRun(run.id, {
      status: "completed",
      pages_checked: pagesChecked,
      pages_changed: pagesChanged,
      events_upserted: eventsUpserted,
      expired_purged: expiredPurged,
      low_confidence_count: lowConfidenceCount,
      notes: `Checked ${pagesChecked} registry pages; recomputed active client matches.`,
    });
  } catch (error) {
    return updateIngestionRun(run.id, {
      status: "failed",
      pages_checked: pagesChecked,
      pages_changed: pagesChanged,
      events_upserted: eventsUpserted,
      low_confidence_count: lowConfidenceCount,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
