import type { ClientRecord, EngagementStatus } from "@/lib/types";

export const ENGAGEMENT_STALE_HOURS = 24;

const allowedStatuses = new Set<EngagementStatus>([
  "active",
  "dormant",
  "inactive",
  "unknown",
]);

export class ForbiddenError extends Error {
  status = 403;

  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function normalizeEngagementStatus(value: unknown): EngagementStatus {
  const normalized = String(value ?? "unknown").trim().toLowerCase();
  return allowedStatuses.has(normalized as EngagementStatus)
    ? (normalized as EngagementStatus)
    : "unknown";
}

export function engagementAgeHours(value?: string | null) {
  if (!value) return Infinity;
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) return Infinity;
  return (Date.now() - parsed) / 3.6e6;
}

export function isFreshEngagement(client: Pick<ClientRecord, "engagement_as_of">) {
  return engagementAgeHours(client.engagement_as_of) <= ENGAGEMENT_STALE_HOURS;
}

export function isPushableClient(
  client: Pick<ClientRecord, "engagement_status" | "engagement_as_of">,
) {
  return client.engagement_status === "active" && isFreshEngagement(client);
}

export function pushEligibilityReason(
  client: Pick<ClientRecord, "engagement_status" | "engagement_as_of">,
) {
  if (client.engagement_status !== "active") {
    return `Not pushable: customer is ${client.engagement_status}`;
  }

  if (!isFreshEngagement(client)) {
    return "Not pushable: engagement status is stale";
  }

  return "Pushable: active engagement status is fresh";
}

export function assertPushable(
  client: Pick<ClientRecord, "engagement_status" | "engagement_as_of">,
) {
  if (client.engagement_status !== "active") {
    throw new ForbiddenError(`Not pushable: customer is ${client.engagement_status}`);
  }

  if (!isFreshEngagement(client)) {
    throw new ForbiddenError("Not pushable: engagement status is stale");
  }
}
