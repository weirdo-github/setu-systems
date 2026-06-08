import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { listEvents, upsertEvent } from "@/lib/repository";

export async function GET() {
  const { response } = await requireUser();
  if (response) return response;
  return NextResponse.json({ events: await listEvents() });
}

export async function POST(request: Request) {
  const { response } = await requireUser();
  if (response) return response;
  const payload = await request.json();
  const event = await upsertEvent(payload);
  return NextResponse.json({ event }, { status: 201 });
}
