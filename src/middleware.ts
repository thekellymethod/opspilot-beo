import { type NextRequest, NextResponse } from "next/server";
import { STAFF_SESSION_COOKIE } from "@/lib/staff-auth/constants";
import { createClient } from "@/utils/supabase/middleware";

/**
 * Only run Supabase session refresh when SSR auth cookies are present.
 * Otherwise every page navigation paid for a remote `getUser()` call.
 */
function hasSupabaseSessionCookies(request: NextRequest): boolean {
  return request.cookies.getAll().some(({ name }) => {
    if (name === "sb-access-token" || name === "sb-refresh-token") return true;
    return name.startsWith("sb-") && name.includes("auth-token");
  });
}

function hasSupabaseBrowserEnv(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/staff/event/")) {
    const sessionToken = request.cookies.get(STAFF_SESSION_COOKIE)?.value;
    if (!sessionToken) {
      return NextResponse.redirect(new URL("/staff/login", request.url));
    }
    return NextResponse.next();
  }

  if (!hasSupabaseSessionCookies(request)) {
    return NextResponse.next();
  }

  /** Stale cookies from another app or missing .env would otherwise throw or hang inside `createServerClient` / `getUser`. */
  if (!hasSupabaseBrowserEnv()) {
    return NextResponse.next();
  }

  try {
    const { supabase, supabaseResponse } = createClient(request);
    await supabase.auth.getUser();
    return supabaseResponse;
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
