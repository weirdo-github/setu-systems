import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { MediaRepositoryError } from "@/lib/mediaRepository";
import type { User } from "@/lib/types";

export function mediaJsonError(error: unknown) {
  if (error instanceof MediaRepositoryError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("Media API failed", error);
  return NextResponse.json({ error: "Media operation failed." }, { status: 500 });
}

export async function requireDiscoverAdmin(): Promise<
  { user: User; response: null } | { user: null; response: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (user.role !== "admin") {
    return { user: null, response: NextResponse.json({ error: "Admin access required" }, { status: 403 }) };
  }
  return { user, response: null };
}

export function isWriterSurface(request: Request) {
  return request.headers.get("x-setu-media-surface") === "writer";
}
