import { notFound } from "next/navigation";
import { SetuDiscoverPortal } from "@/components/SetuDiscoverPortal";

export const metadata = {
  title: "setu discovery",
};

const supportedSections = new Set([
  "",
  "dashboard",
  "inventory",
  "clients",
  "match-send",
  "matches",
  "email-log",
  "emails",
  "source-registry",
  "sources",
  "daily-refresh",
  "ingestion",
  "review-queue",
  "review",
]);

export default async function DiscoverPage({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section = [] } = await params;
  const path = section.join("/");

  if (!supportedSections.has(path)) {
    notFound();
  }

  return <SetuDiscoverPortal />;
}
