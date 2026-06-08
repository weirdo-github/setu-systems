import { NextResponse } from "next/server";
import { mediaJsonError, requireDiscoverAdmin } from "@/lib/mediaApi";
import { listMediaWriters } from "@/lib/mediaRepository";

export async function GET() {
  const { response } = await requireDiscoverAdmin();
  if (response) return response;

  try {
    return NextResponse.json({ writers: await listMediaWriters() });
  } catch (error) {
    return mediaJsonError(error);
  }
}
