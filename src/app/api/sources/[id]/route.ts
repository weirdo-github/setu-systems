import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { upsertSource } from "@/lib/repository";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { response } = await requireUser();
  if (response) return response;
  const { id } = await context.params;
  const payload = await request.json();
  const source = await upsertSource(payload, id);
  return NextResponse.json({ source });
}
