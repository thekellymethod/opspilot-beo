import { NextResponse } from "next/server";
import { getEventTaskById, updateEventTask } from "@/lib/store";

export async function PATCH(request: Request, context: { params: Promise<{ id: string; taskId: string }> }) {
  const { id, taskId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    ownerEmployeeId?: string | null;
    ownerDepartment?: string | null;
    assignedBy?: string | null;
  };

  const task = await getEventTaskById(taskId);
  if (!task || task.event_id !== id) {
    return NextResponse.json({ error: "Task not found for this event." }, { status: 404 });
  }

  const updated = await updateEventTask(taskId, {
    owner_employee_id: body.ownerEmployeeId ?? null,
    owner_department: (body.ownerDepartment as typeof task.owner_department) ?? null,
    assigned_at: new Date().toISOString(),
    assigned_by: body.assignedBy ?? "manager",
  });

  return NextResponse.json({ ok: true, task: updated });
}
