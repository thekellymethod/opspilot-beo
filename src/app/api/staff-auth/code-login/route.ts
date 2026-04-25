import { NextRequest, NextResponse } from "next/server";
import {
  STAFF_SESSION_COOKIE,
  STAFF_SESSION_MAX_AGE_SECONDS,
} from "@/lib/staff-auth/constants";
import { loginWithCodes } from "@/lib/staff-auth/service";

type RequestBody = {
  employeeCode?: string;
  eventCode?: string;
  deviceLabel?: string;
};

export async function POST(req: NextRequest) {
  let body: RequestBody;

  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body." },
      { status: 400 },
    );
  }

  const result = await loginWithCodes({
    employeeCode: body.employeeCode ?? "",
    eventCode: body.eventCode ?? "",
    deviceLabel: body.deviceLabel ?? null,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status },
    );
  }

  const response = NextResponse.json({
    ok: true,
    staffSession: result.staffSession,
  });

  response.cookies.set(STAFF_SESSION_COOKIE, result.sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STAFF_SESSION_MAX_AGE_SECONDS,
  });

  return response;
}
