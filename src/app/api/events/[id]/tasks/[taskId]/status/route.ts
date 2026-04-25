import { NextResponse } from "next/server";
import { getEventTaskById, updateEventTask } from "@/lib/store";

export async function PATCH(request: Request, context: { params: Promise<{ id: string; taskId: string }> }) {
  const { id, taskId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    status?: "pending" | "acknowledged" | "blocked" | "complete";
    actor?: string;
    note?: string | null;
  };
  const status = body.status;
  if (!status) return NextResponse.json({ error: "status is required" }, { status: 400 });

  const task = await getEventTaskById(taskId);
  if (!task || task.event_id !== id) {
    return NextResponse.json({ error: "Task not found for this event." }, { status: 404 });
  }

  const now = new Date().toISOString();
  const updated = await updateEventTask(taskId, {
    status,
    acknowledged_at: status === "acknowledged" ? now : task.acknowledged_at ?? null,
    acknowledged_by: status === "acknowledged" ? body.actor ?? "staff" : task.acknowledged_by ?? null,
    completed_at: status === "complete" ? now : task.completed_at ?? null,
    completion_note: status === "complete" ? body.note ?? task.completion_note ?? null : task.completion_note ?? null,
  });
  return NextResponse.json({ ok: true, task: updated });
}
