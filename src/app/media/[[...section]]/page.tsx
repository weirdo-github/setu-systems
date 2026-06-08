import { notFound } from "next/navigation";
import { SetuMediaPortal } from "@/components/SetuMediaPortal";

export const metadata = {
  title: "setu media",
};

const supportedSections = new Set(["", "assignments", "history"]);

export default async function MediaPage({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section = [] } = await params;
  const path = section.join("/");

  if (!supportedSections.has(path)) {
    notFound();
  }

  return <SetuMediaPortal />;
}
