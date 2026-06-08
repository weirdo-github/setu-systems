import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { runPhase2Ingestion } from "@/lib/phase2-ingestion";

function hasRunToken(request: Request) {
  const expected = process.env.PHASE2_RUN_TOKEN;
  if (!expected) return false;
  return request.headers.get("x-discover-run-token") === expected;
}

export async function POST(request: Request) {
  if (!hasRunToken(request)) {
    const { response } = await requireUser();
    if (response) return response;
  }

  const payload = await request.json().catch(() => ({}));
  const run = await runPhase2Ingestion(String(payload.mode ?? "manual"));
  return NextResponse.json({ run });
}
