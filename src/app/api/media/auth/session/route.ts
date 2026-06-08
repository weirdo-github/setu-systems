import { NextResponse } from "next/server";
import { getCurrentMediaUser } from "@/lib/mediaAuth";

export async function GET() {
  const user = await getCurrentMediaUser();
  return NextResponse.json({ user });
}
