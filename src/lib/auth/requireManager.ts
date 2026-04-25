import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

/**
 * Ensures a signed-in Supabase user is present. If `MANAGER_EMAIL_ALLOWLIST` is set
 * (comma-separated, case-insensitive), the user email must match one entry.
 */
export async function requireManagerUser(): Promise<
  | { ok: true; user: User }
  | { ok: false; status: number; message: string }
> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { ok: false, status: 401, message: "Authentication required." };
  }

  const raw = process.env.MANAGER_EMAIL_ALLOWLIST?.trim();
  if (raw) {
    const allow = new Set(
      raw
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    );
    const email = user.email?.trim().toLowerCase();
    if (!email || !allow.has(email)) {
      return { ok: false, status: 403, message: "Not authorized for manager actions." };
    }
  }

  return { ok: true, user };
}
