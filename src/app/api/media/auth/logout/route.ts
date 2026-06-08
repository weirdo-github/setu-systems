import { NextResponse } from "next/server";
import { mediaSessionCookieName } from "@/lib/constants";
import { destroyMediaSession } from "@/lib/mediaAuth";

export async function POST() {
  await destroyMediaSession();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(mediaSessionCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
