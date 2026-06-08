import { NextResponse } from "next/server";
import { requireMediaUser } from "@/lib/mediaAuth";
import { mediaJsonError } from "@/lib/mediaApi";
import { addWorkLogEntry } from "@/lib/mediaRepository";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireMediaUser();
  if (response) return response;

  try {
    const { id } = await context.params;
    const payload = await request.json();
    const assignment = await addWorkLogEntry(id, user.id, payload);
    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error) {
    return mediaJsonError(error);
  }
}
