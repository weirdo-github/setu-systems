import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { makeId, query } from "@/lib/db";
import { mediaSessionCookieName } from "@/lib/constants";
import type { MediaUser } from "@/lib/types";

export async function getCurrentMediaUser(): Promise<MediaUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(mediaSessionCookieName)?.value;
  if (!token) return null;

  const rows = await query<MediaUser>(
    `SELECT media_users.id, media_users.email, media_users.display_name, media_users.role, media_users.active
     FROM media_sessions
     JOIN media_users ON media_users.id = media_sessions.media_user_id
     WHERE media_sessions.id = $1
       AND media_sessions.expires_at > now()
       AND media_users.active = TRUE
     LIMIT 1`,
    [token],
  );

  return rows[0] ?? null;
}

export async function requireMediaUser() {
  const user = await getCurrentMediaUser();
  if (!user) {
    return { user: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { user, response: null };
}

export async function createMediaSession(mediaUserId: string) {
  const token = makeId("mses");
  await query(
    `INSERT INTO media_sessions (id, media_user_id, expires_at)
     VALUES ($1, $2, now() + interval '14 days')`,
    [token, mediaUserId],
  );
  return token;
}

export async function destroyMediaSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(mediaSessionCookieName)?.value;
  if (token) {
    await query("DELETE FROM media_sessions WHERE id = $1", [token]);
  }
}
