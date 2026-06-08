import { NextResponse } from "next/server";
import { mediaSessionCookieName } from "@/lib/constants";
import { createMediaSession } from "@/lib/mediaAuth";
import { verifyMediaLogin } from "@/lib/mediaRepository";

export async function POST(request: Request) {
  const payload = await request.json();
  const email = String(payload.email ?? "").trim().toLowerCase();
  const password = String(payload.password ?? "");
  const user = await verifyMediaLogin(email, password);

  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await createMediaSession(user.id);
  const response = NextResponse.json({ user });
  response.cookies.set(mediaSessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return response;
}
