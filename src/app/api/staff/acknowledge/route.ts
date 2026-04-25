import { NextRequest, NextResponse } from "next/server";
import { assertStaffActionAllowed } from "@/lib/staff-auth/permissions";
import { getStaffSession } from "@/lib/staff-auth/session";
import { acknowledgeBriefing } from "@/lib/staff-actions/repository";

type RequestBody = {
  eventId?: string;
  department?: string;
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

  const eventId = String(body.eventId ?? "").trim();
  const department = String(
    body.department ?? session.employee.department,
  )
    .trim()
    .toLowerCase();

  if (!eventId) {
    return NextResponse.json(
      { ok: false, error: "Event ID is required." },
      { status: 400 },
    );
  }

  if (eventId !== session.event.id) {
    return NextResponse.json(
      { ok: false, error: "Event mismatch." },
      { status: 403 },
    );
  }

  try {
    assertStaffActionAllowed(session, "briefing.acknowledge", department);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Action not permitted." },
      { status: 403 },
    );
  }

  const result = await acknowledgeBriefing({
    eventId,
    department,
    employeeId: session.employee.id,
    acknowledgedBy: session.employee.name,
  });

  return NextResponse.json({
    ok: true,
    acknowledgment: result,
  });
}
