import { NextResponse } from "next/server";
import { mediaJsonError, requireDiscoverAdmin } from "@/lib/mediaApi";
import { recordPublication } from "@/lib/mediaRepository";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireDiscoverAdmin();
  if (response) return response;

  try {
    const { id } = await context.params;
    const payload = await request.json();
    const assignment = await recordPublication(id, user.email, payload);
    return NextResponse.json({ assignment });
  } catch (error) {
    return mediaJsonError(error);
  }
}
