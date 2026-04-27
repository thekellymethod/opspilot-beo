import { NextResponse } from "next/server";
import { getEventTaskById, updateEventTask } from "@/lib/store";

export async function PATCH(request: Request, context: { params: Promise<{ id: string; taskId: string }> }) {
  const { id, taskId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    index?: number;
    done?: boolean;
  };
  const index = body.index;
  const done = body.done;
  if (typeof index !== "number" || index < 0 || Number.isNaN(index)) {
    return NextResponse.json({ error: "index must be a non-negative number" }, { status: 400 });
  }
  if (typeof done !== "boolean") {
    return NextResponse.json({ error: "done must be a boolean" }, { status: 400 });
  }

  const task = await getEventTaskById(taskId);
  if (!task || task.event_id !== id) {
    return NextResponse.json({ error: "Task not found for this event." }, { status: 404 });
  }
  if (index >= task.checklist.length) {
    return NextResponse.json({ error: "index out of range for this task checklist" }, { status: 400 });
  }

  const nextDone = (task.checklist_done ?? task.checklist.map(() => false)).slice(0, task.checklist.length);
  while (nextDone.length < task.checklist.length) nextDone.push(false);
  nextDone[index] = done;

  const updated = await updateEventTask(taskId, { checklist_done: nextDone });
  return NextResponse.json({ ok: true, task: updated });
}
