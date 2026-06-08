import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { query, makeId } from "@/lib/db";
import { sessionCookieName } from "@/lib/constants";
import type { User } from "@/lib/types";

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const key = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${key}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, expected] = storedHash.split(":");
  if (!salt || !expected) return false;
  const key = crypto.scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, "hex");
  return expectedBuffer.length === key.length && crypto.timingSafeEqual(key, expectedBuffer);
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  if (!token) return null;

  const rows = await query<User>(
    `SELECT users.id, users.name, users.email, users.role
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.id = $1 AND sessions.expires_at > now()
     LIMIT 1`,
    [token],
  );

  return rows[0] ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { user, response: null };
}

export async function createSession(userId: string) {
  const token = makeId("ses");
  await query(
    `INSERT INTO sessions (id, user_id, expires_at)
     VALUES ($1, $2, now() + interval '14 days')`,
    [token, userId],
  );
  return token;
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  if (token) {
    await query("DELETE FROM sessions WHERE id = $1", [token]);
  }
}
