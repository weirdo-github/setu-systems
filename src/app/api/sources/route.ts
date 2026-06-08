import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { listSources, upsertSource } from "@/lib/repository";

export async function GET() {
  const { response } = await requireUser();
  if (response) return response;
  return NextResponse.json({ sources: await listSources() });
}

export async function POST(request: Request) {
  const { response } = await requireUser();
  if (response) return response;
  const payload = await request.json();
  const source = await upsertSource(payload);
  return NextResponse.json({ source }, { status: 201 });
}
