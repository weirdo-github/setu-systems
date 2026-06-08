import { NextResponse } from "next/server";
import { requireMediaUser } from "@/lib/mediaAuth";
import { mediaJsonError } from "@/lib/mediaApi";
import { startAssignment } from "@/lib/mediaRepository";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireMediaUser();
  if (response) return response;

  try {
    const { id } = await context.params;
    const assignment = await startAssignment(id, user.id);
    return NextResponse.json({ assignment });
  } catch (error) {
    return mediaJsonError(error);
  }
}
