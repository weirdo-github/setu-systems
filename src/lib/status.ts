function parseDeadline(deadline: string | Date | null) {
  if (!deadline) return null;
  if (deadline instanceof Date) return Number.isNaN(deadline.getTime()) ? null : deadline;

  const value = deadline.includes("T") ? deadline : `${deadline}T00:00:00`;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function deriveStatus(deadline: string | Date | null, archived: boolean, manualStatus?: string) {
  if (archived || manualStatus === "inactive") return "Inactive";
  if (!deadline) return "Rolling";

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = parseDeadline(deadline);
  if (!due) return "Rolling";
  if (due < now) return "Expired";

  const days = Math.ceil((due.getTime() - now.getTime()) / 86_400_000);
  if (days <= 14) return "Closing";
  return "Active";
}

export function statusTone(status: string) {
  if (status === "Active") return "success";
  if (status === "Closing") return "warn";
  if (status === "Expired") return "danger";
  if (status === "Inactive") return "neutral";
  return "ink";
}
