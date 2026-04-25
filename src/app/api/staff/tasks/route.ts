import { NextResponse } from "next/server";
import { assertStaffActionAllowed } from "@/lib/staff-auth/permissions";
import { getStaffSession } from "@/lib/staff-auth/session";
import { listTasksForEventAndDepartment } from "@/lib/staff-actions/repository";

export async function GET() {
  const session = await getStaffSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated." },
      { status: 401 },
    );
  }

  try {
    assertStaffActionAllowed(
      session,
      "department.view",
      session.employee.department,
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Action not permitted." },
      { status: 403 },
    );
  }

  const tasks = await listTasksForEventAndDepartment({
    eventId: session.event.id,
    department: session.employee.department,
  });

  return NextResponse.json({
    ok: true,
    tasks,
  });
}
