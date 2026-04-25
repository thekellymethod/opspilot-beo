import { NextRequest, NextResponse } from "next/server";
import { STAFF_SESSION_COOKIE } from "@/lib/staff-auth/constants";
import { deactivateEventSession } from "@/lib/staff-auth/repository";

export async function POST(req: NextRequest) {
  const sessionToken = req.cookies.get(STAFF_SESSION_COOKIE)?.value;

  if (sessionToken) {
    await deactivateEventSession(sessionToken);
  }

  const accept = req.headers.get("accept") ?? "";
  const wantsJson = accept.includes("application/json");

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };

  if (wantsJson) {
    const response = NextResponse.json({ ok: true });
    response.cookies.set(STAFF_SESSION_COOKIE, "", cookieOptions);
    return response;
  }

  const response = NextResponse.redirect(new URL("/staff/login", req.url));
  response.cookies.set(STAFF_SESSION_COOKIE, "", cookieOptions);
  return response;
}
