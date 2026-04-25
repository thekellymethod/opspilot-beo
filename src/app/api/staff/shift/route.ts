import { NextRequest, NextResponse } from "next/server";
import { assertStaffActionAllowed } from "@/lib/staff-auth/permissions";
import { getStaffSession } from "@/lib/staff-auth/session";
import { recordShiftEvent } from "@/lib/staff-actions/repository";

type RequestBody = {
  eventType?: "checkin" | "checkout";
  note?: string;
};

export async function POST(req: NextRequest) {
  const session = await getStaffSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated." },
      { status: 401 },
    );
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body." },
      { status: 400 },
    );
  }

  const eventType = body.eventType;
  if (eventType !== "checkin" && eventType !== "checkout") {
    return NextResponse.json(
      { ok: false, error: "Valid eventType is required." },
      { status: 400 },
    );
  }

  try {
    assertStaffActionAllowed(
      session,
      eventType === "checkin" ? "shift.checkin" : "shift.checkout",
      session.employee.department,
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Action not permitted." },
      { status: 403 },
    );
  }

  const shiftEvent = await recordShiftEvent({
    eventId: session.event.id,
    employeeId: session.employee.id,
    eventType,
    note: body.note ?? null,
  });

  return NextResponse.json({
    ok: true,
    shiftEvent,
  });
}
