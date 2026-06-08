import { NextResponse } from "next/server";
import { requireMediaUser } from "@/lib/mediaAuth";
import { mediaJsonError } from "@/lib/mediaApi";
import { submitAssignment } from "@/lib/mediaRepository";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireMediaUser();
  if (response) return response;

  try {
    const { id } = await context.params;
    const payload = await request.json().catch(() => ({}));
    const assignment = await submitAssignment(id, user.id, payload);
    return NextResponse.json({ assignment });
  } catch (error) {
    return mediaJsonError(error);
  }
}
