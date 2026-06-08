import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentMediaUser } from "@/lib/mediaAuth";
import { isWriterSurface, mediaJsonError, requireDiscoverAdmin } from "@/lib/mediaApi";
import {
  getAssignmentForAdmin,
  getAssignmentForWriter,
  updateAssignment,
} from "@/lib/mediaRepository";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;

    if (isWriterSurface(request)) {
      const mediaUser = await getCurrentMediaUser();
      if (!mediaUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      return NextResponse.json({ assignment: await getAssignmentForWriter(id, mediaUser.id) });
    }

    const discoverUser = await getCurrentUser();
    if (discoverUser) {
      if (discoverUser.role !== "admin") {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }
      return NextResponse.json({ assignment: await getAssignmentForAdmin(id) });
    }

    const mediaUser = await getCurrentMediaUser();
    if (!mediaUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ assignment: await getAssignmentForWriter(id, mediaUser.id) });
  } catch (error) {
    return mediaJsonError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireDiscoverAdmin();
  if (response) return response;

  try {
    const { id } = await context.params;
    const payload = await request.json();
    const assignment = await updateAssignment(id, payload, user.email);
    return NextResponse.json({ assignment });
  } catch (error) {
    return mediaJsonError(error);
  }
}
