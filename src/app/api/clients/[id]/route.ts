import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { deleteClient, upsertClient } from "@/lib/repository";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { response } = await requireUser();
  if (response) return response;
  const { id } = await context.params;
  const payload = await request.json();
  const client = await upsertClient(payload, id);
  return NextResponse.json({ client });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { response } = await requireUser();
  if (response) return response;
  const { id } = await context.params;
  await deleteClient(id);
  return NextResponse.json({ ok: true });
}
