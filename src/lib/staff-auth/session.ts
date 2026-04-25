import { cookies } from "next/headers";
import { STAFF_SESSION_COOKIE } from "./constants";
import { buildStaffSessionFromToken } from "./repository";
import type { StaffSession } from "./types";

export async function getStaffSession(): Promise<StaffSession | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(STAFF_SESSION_COOKIE)?.value;

  if (!sessionToken) return null;
  return buildStaffSessionFromToken(sessionToken);
}

export async function requireStaffSession(): Promise<StaffSession> {
  const session = await getStaffSession();
  if (!session) {
    throw new Error("Staff session not found.");
  }
  return session;
}
