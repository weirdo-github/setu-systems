import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";
import { sessionCookieName } from "@/lib/constants";

export async function POST() {
  await destroySession();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
