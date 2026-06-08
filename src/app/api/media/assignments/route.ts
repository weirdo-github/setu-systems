import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentMediaUser, requireMediaUser } from "@/lib/mediaAuth";
import { isWriterSurface, mediaJsonError, requireDiscoverAdmin } from "@/lib/mediaApi";
import {
  createAssignment,
  listAssignmentsForAdmin,
  listAssignmentsForWriter,
} from "@/lib/mediaRepository";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const writerId = url.searchParams.get("writerId");

    if (isWriterSurface(request)) {
      const { user, response } = await requireMediaUser();
      if (response) return response;
      return NextResponse.json({
        assignments: await listAssignmentsForWriter(user.id, status),
      });
    }

    const discoverUser = await getCurrentUser();
    if (discoverUser) {
      if (discoverUser.role !== "admin") {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }
      return NextResponse.json({
        assignments: await listAssignmentsForAdmin({ status, writerId }),
      });
    }

    const mediaUser = await getCurrentMediaUser();
    if (!mediaUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      assignments: await listAssignmentsForWriter(mediaUser.id, status),
    });
  } catch (error) {
    return mediaJsonError(error);
  }
}

export async function POST(request: Request) {
  const { user, response } = await requireDiscoverAdmin();
  if (response) return response;

  try {
    const payload = await request.json();
    const assignment = await createAssignment(payload, user.email);
    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error) {
    return mediaJsonError(error);
  }
}
