import { NextRequest, NextResponse } from "next/server";
import { assertStaffActionAllowed } from "@/lib/staff-auth/permissions";
import { getStaffSession } from "@/lib/staff-auth/session";
import { completeTask, findTaskById } from "@/lib/staff-actions/repository";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ taskId: string }> },
) {
  const session = await getStaffSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated." },
      { status: 401 },
    );
  }

  const { taskId } = await context.params;
  const task = await findTaskById(taskId);

  if (!task) {
    return NextResponse.json(
      { ok: false, error: "Task not found." },
      { status: 404 },
    );
  }

  if (task.eventId !== session.event.id) {
    return NextResponse.json(
      { ok: false, error: "Task event mismatch." },
      { status: 403 },
    );
  }

  try {
    assertStaffActionAllowed(session, "task.complete", task.department);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Action not permitted." },
      { status: 403 },
    );
  }

  if (
    task.assignedToEmployeeId &&
    task.assignedToEmployeeId !== session.employee.id &&
    session.employee.department.toLowerCase() !== "management"
  ) {
    return NextResponse.json(
      { ok: false, error: "Task is assigned to another employee." },
      { status: 403 },
    );
  }

  const updated = await completeTask({
    taskId,
    employeeId: session.employee.id,
  });

  if (!updated) {
    return NextResponse.json(
      { ok: false, error: "Unable to complete task." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    task: updated,
  });
}
