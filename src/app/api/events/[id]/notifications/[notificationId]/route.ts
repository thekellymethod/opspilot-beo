import { NextResponse } from "next/server";
import { listAlerts, updateAlert } from "@/lib/store";

export async function PATCH(request: Request, context: { params: Promise<{ id: string; notificationId: string }> }) {
  const { id, notificationId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    state?: "new" | "acknowledged" | "resolved" | "escalated";
    ownerDepartment?: string | null;
    ownerEmployeeId?: string | null;
    dueAt?: string | null;
    actor?: string | null;
  };

  const alerts = await listAlerts(id);
  const target = alerts.find((a) => a.id === notificationId);
  if (!target) return NextResponse.json({ error: "Notification not found." }, { status: 404 });

  const now = new Date().toISOString();
  const state = body.state ?? target.state ?? "new";
  const updated = await updateAlert(notificationId, {
    state,
    resolved: state === "resolved",
    owner_department: (body.ownerDepartment as typeof target.owner_department) ?? target.owner_department ?? null,
    owner_employee_id: body.ownerEmployeeId ?? target.owner_employee_id ?? null,
    due_at: body.dueAt ?? target.due_at ?? null,
    acknowledged_at: state === "acknowledged" ? now : target.acknowledged_at ?? null,
    acknowledged_by: state === "acknowledged" ? body.actor ?? "manager" : target.acknowledged_by ?? null,
    resolved_at: state === "resolved" ? now : target.resolved_at ?? null,
    resolved_by: state === "resolved" ? body.actor ?? "manager" : target.resolved_by ?? null,
    escalation_level: state === "escalated" ? (target.escalation_level ?? 0) + 1 : target.escalation_level ?? 0,
  });
  return NextResponse.json({ ok: true, notification: updated });
}
