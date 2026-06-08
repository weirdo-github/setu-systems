import { NextResponse } from "next/server";
import { mediaJsonError, requireDiscoverAdmin } from "@/lib/mediaApi";
import { listClientMediaAssignments } from "@/lib/mediaRepository";

export async function GET(
  _request: Request,
  context: { params: Promise<{ clientId: string }> },
) {
  const { response } = await requireDiscoverAdmin();
  if (response) return response;

  try {
    const { clientId } = await context.params;
    return NextResponse.json({ assignments: await listClientMediaAssignments(clientId) });
  } catch (error) {
    return mediaJsonError(error);
  }
}
