import { NextResponse } from "next/server";
import {
  getEvent,
  getPinnedOrLatestVersion,
  listAlerts,
  listEventConfirmations,
  listEventStaffAssignments,
  listEventTasks,
} from "@/lib/store";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const [event, version, tasks, notifications, confirmations, assignments] = await Promise.all([
    getEvent(id),
    getPinnedOrLatestVersion(id),
    listEventTasks(id, { includeArchived: true }),
    listAlerts(id),
    listEventConfirmations(id),
    listEventStaffAssignments(id),
  ]);

  if (!event || !version) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json({
    event,
    version: { id: version.id, version_number: version.version_number, created_at: version.created_at },
    tasks,
    notifications,
    confirmations,
    assignments,
  });
}
