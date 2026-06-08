import { NextResponse } from "next/server";
import { mediaJsonError, requireDiscoverAdmin } from "@/lib/mediaApi";
import { reassignAssignment } from "@/lib/mediaRepository";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireDiscoverAdmin();
  if (response) return response;

  try {
    const { id } = await context.params;
    const payload = await request.json();
    const assignment = await reassignAssignment(id, user.email, String(payload.media_user_id ?? "").trim());
    return NextResponse.json({ assignment });
  } catch (error) {
    return mediaJsonError(error);
  }
}
