import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { archiveEvent, upsertEvent } from "@/lib/repository";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { response } = await requireUser();
  if (response) return response;
  const { id } = await context.params;
  const payload = await request.json();
  const event = await upsertEvent(payload, id);
  return NextResponse.json({ event });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { response } = await requireUser();
  if (response) return response;
  const { id } = await context.params;
  const event = await archiveEvent(id);
  return NextResponse.json({ event });
}
