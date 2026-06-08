import type { ClientRecord, EventRecord, MatchBreakdown, MatchRecord } from "@/lib/types";

function clean(value: string) {
  return value.trim().toLowerCase();
}

function unique(values: string[]) {
  return [...new Set(values.map(clean).filter(Boolean))];
}

function overlap(left: string[], right: string[]) {
  const rightSet = new Set(unique(right));
  return unique(left).filter((item) => rightSet.has(item));
}

const semanticAliases: Record<string, string[]> = {
  ai: ["artificial", "intelligence", "machine", "learning", "data"],
  artificial: ["ai", "machine", "learning"],
  intelligence: ["ai", "machine", "learning"],
  cloud: ["platform", "infrastructure", "reliability", "systems"],
  infrastructure: ["cloud", "platform", "systems", "reliability"],
  awards: ["recognition", "nomination", "prize", "honor"],
  judging: ["review", "reviewer", "panel", "peer"],
  authorship: ["article", "publication", "writing", "contribute", "pitch"],
  media: ["press", "published", "interview", "opinion"],
  speaking: ["speaker", "conference", "cfp", "proposal", "talk"],
  membership: ["fellow", "senior", "member", "society"],
  leadership: ["board", "editorial", "working", "group", "standards"],
};

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
}

function semanticTerms(values: string[]) {
  const terms = new Set<string>();
  for (const token of tokenize(values.join(" "))) {
    terms.add(token);
    for (const alias of semanticAliases[token] ?? []) {
      terms.add(alias);
    }
  }
  return terms;
}

function semanticSimilarity(client: ClientRecord, event: EventRecord) {
  const clientTerms = semanticTerms([
    client.field,
    client.location,
    client.notes,
    ...client.target_criteria,
    ...client.keywords,
    ...client.preferred_categories,
  ]);
  const eventTerms = semanticTerms([
    event.title,
    event.category,
    event.field,
    event.location,
    event.summary,
    event.notes,
    ...event.criteria_tags,
    ...event.keywords,
  ]);

  if (!clientTerms.size || !eventTerms.size) return 0.35;
  let intersection = 0;
  for (const term of clientTerms) {
    if (eventTerms.has(term)) intersection += 1;
  }
  const union = new Set([...clientTerms, ...eventTerms]).size;
  return union ? intersection / union : 0;
}

function categoryKey(value: string) {
  const normalized = clean(value);
  const aliases: Record<string, string> = {
    award: "awards",
    awards: "awards",
    "awards & nominations": "awards",
    press: "media",
    media: "media",
    "media & interview": "media",
    interview: "media",
    publications: "authorship",
    publication: "authorship",
    authorship: "authorship",
    memberships: "memberships",
    membership: "memberships",
    "memberships & fellowships": "memberships",
    fellowship: "memberships",
    fellowships: "memberships",
    exhibitions: "exhibitions",
    exhibition: "exhibitions",
    "exhibitions & showcases": "exhibitions",
    showcase: "exhibitions",
    showcases: "exhibitions",
    editorial: "leadership",
    board: "leadership",
    leadership: "leadership",
    "editorial / board / leadership": "leadership",
  };
  return aliases[normalized] ?? normalized;
}

function hasLocationFit(clientLocation: string, eventLocation: string) {
  const client = clean(clientLocation);
  const event = clean(eventLocation);
  if (!client || !event) return 0.45;
  if (event.includes("remote") || event.includes("virtual")) return 1;
  if (client === event || event.includes(client) || client.includes(event)) return 1;
  const clientState = client.split(",").at(-1)?.trim();
  const eventState = event.split(",").at(-1)?.trim();
  return clientState && eventState && clientState === eventState ? 0.75 : 0.2;
}

export function scoreMatch(client: ClientRecord, event: EventRecord): MatchBreakdown {
  const target = client.target_criteria.filter(Boolean);
  const covered = new Set(unique(client.covered_criteria));
  const missing = target.filter((criterion) => !covered.has(clean(criterion)));
  const eventCriteria = new Set(unique(event.criteria_tags));
  const missingHits = missing.filter((criterion) => eventCriteria.has(clean(criterion)));

  const criterionGap = missing.length
    ? (missingHits.length / missing.length) * 42
    : overlap(target, event.criteria_tags).length
      ? 26
      : 10;

  const tierWeight = event.credibility_tier === 1 ? 1 : event.credibility_tier === 2 ? 0.78 : 0.48;
  const payToPlayPenalty =
    Number(event.fee_amount ?? 0) > 0 && event.credibility_tier === 3 ? 0.58 : 1;
  const credibility = 20 * tierWeight * payToPlayPenalty;

  const eventTerms = unique([
    ...event.keywords,
    event.title,
    event.field,
    event.summary,
    event.category,
  ]);
  const clientTerms = unique([...client.keywords, client.field, ...client.preferred_categories]);
  const matchedKeywords = clientTerms.filter((term) =>
    eventTerms.some((eventTerm) => eventTerm.includes(term) || term.includes(eventTerm)),
  );
  const keyword = clientTerms.length ? Math.min(14, (matchedKeywords.length / clientTerms.length) * 22) : 4;
  const semantic = semanticSimilarity(client, event) * 14;

  const actionability = (event.actionability / 5) * 12;
  const location = hasLocationFit(client.location, event.location) * 8;
  const eventCategory = categoryKey(event.category);
  const categoryBoost = client.preferred_categories.some((category) => categoryKey(category) === eventCategory)
    ? 4
    : 0;
  const total = Math.min(100, criterionGap + credibility + keyword + semantic + actionability + location + categoryBoost);

  const flags = [];
  if (event.derived_status === "Closing") flags.push("deadline closing");
  if (event.derived_status === "Expired") flags.push("expired");
  if (Number(event.fee_amount ?? 0) > 0 && event.credibility_tier === 3) {
    flags.push("fee plus tier 3");
  }
  if (!event.apply_url) flags.push("missing apply link");

  return {
    criterionGap: Number(criterionGap.toFixed(1)),
    credibility: Number(credibility.toFixed(1)),
    keyword: Number(keyword.toFixed(1)),
    semantic: Number(semantic.toFixed(1)),
    actionability: Number(actionability.toFixed(1)),
    location: Number((location + categoryBoost).toFixed(1)),
    total: Number(total.toFixed(1)),
    missingCriteria: missingHits,
    matchedKeywords,
    flags,
  };
}

export function rankMatches(client: ClientRecord, events: EventRecord[]): MatchRecord[] {
  return events
    .filter((event) => !["Expired", "Inactive"].includes(event.derived_status))
    .map((event) => {
      const breakdown = scoreMatch(client, event);
      return {
        event,
        score: breakdown.total,
        breakdown,
      };
    })
    .sort((left, right) => right.score - left.score);
}
