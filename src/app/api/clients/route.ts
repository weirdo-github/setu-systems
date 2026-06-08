import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { listClients, upsertClient } from "@/lib/repository";

export async function GET() {
  const { response } = await requireUser();
  if (response) return response;
  return NextResponse.json({ clients: await listClients() });
}

export async function POST(request: Request) {
  const { response } = await requireUser();
  if (response) return response;
  const payload = await request.json();
  const client = await upsertClient(payload);
  return NextResponse.json({ client }, { status: 201 });
}
