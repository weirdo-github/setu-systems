import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { sessionCookieName } from "@/lib/constants";
import type { User } from "@/lib/types";

type UserWithPassword = User & {
  password_hash: string;
};

export async function POST(request: Request) {
  const payload = await request.json();
  const email = String(payload.email ?? "").trim().toLowerCase();
  const password = String(payload.password ?? "");

  const rows = await query<UserWithPassword>(
    "SELECT id, name, email, role, password_hash FROM users WHERE lower(email) = $1 LIMIT 1",
    [email],
  );
  const user = rows[0];

  if (!user || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await createSession(user.id);
  const response = NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });

  response.cookies.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });

  return response;
}
