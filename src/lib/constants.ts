export const EVENT_CATEGORIES = [
  "Authorship",
  "Judging",
  "Speaking",
  "Awards & Nominations",
  "Memberships & Fellowships",
  "Editorial / Board / Leadership",
  "Media & Interview",
  "Exhibitions & Showcases",
  "Grants",
  "Awards",
  "Press",
  "Publications",
  "Memberships",
  "Exhibitions",
] as const;

export const CRITERIA_TAGS = [
  "Awards",
  "Memberships",
  "Published Material",
  "Judging",
  "Original Contributions",
  "Scholarly Articles",
  "Exhibitions/Showcases",
  "Leading/Critical Role",
  "High Salary",
  "Commercial Success",
] as const;

export const STATUS_LABELS = [
  "Active",
  "Closing",
  "Rolling",
  "Expired",
  "Inactive",
] as const;

export const credibilityLabels: Record<number, string> = {
  1: "Tier 1",
  2: "Tier 2",
  3: "Tier 3",
};

export const sessionCookieName = "discover_session";
export const mediaSessionCookieName = "media_session";

export const MEDIA_CRITERIA_TAGS = [
  "published_material",
  "original_contributions",
  "authorship",
  "judging",
  "awards",
  "leading_role",
  "other",
] as const;

export const MEDIA_ASSIGNMENT_STATUSES = [
  "assigned",
  "active",
  "submitted",
  "published",
  "closed",
  "incomplete_closed",
] as const;

export const MEDIA_WORK_ENTRY_TYPES = ["note", "draft", "submission"] as const;
