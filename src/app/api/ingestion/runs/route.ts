import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { listIngestionItems, listIngestionRuns } from "@/lib/repository";

export async function GET(request: Request) {
  const { response } = await requireUser();
  if (response) return response;
  const url = new URL(request.url);
  const runId = url.searchParams.get("runId") ?? undefined;
  const [runs, items] = await Promise.all([listIngestionRuns(), listIngestionItems(runId)]);
  return NextResponse.json({ runs, items });
}
