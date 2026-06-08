import { NextResponse } from "next/server";
import { mediaJsonError, requireDiscoverAdmin } from "@/lib/mediaApi";
import { incompleteCloseAssignment } from "@/lib/mediaRepository";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireDiscoverAdmin();
  if (response) return response;

  try {
    const { id } = await context.params;
    const payload = await request.json();
    const assignment = await incompleteCloseAssignment(id, user.email, String(payload.reason ?? "").trim());
    return NextResponse.json({ assignment });
  } catch (error) {
    return mediaJsonError(error);
  }
}
