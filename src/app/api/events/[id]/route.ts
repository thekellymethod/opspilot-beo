import { NextResponse } from "next/server";
import {
  getLatestEventChangeView,
  getEvent,
  getStaffRosterById,
  listAlerts,
  listAvailableStaffForDate,
  listEventConfirmations,
  listEventStaffAssignments,
  listEventTasks,
  getPinnedOrLatestVersion,
  hasPersistentStoreConfig,
} from "@/lib/store";
import { loadPropertyProfile } from "@/lib/beo/propertyProfile";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const event = await getEvent(id);
  const currentVersion = await getPinnedOrLatestVersion(id);
  if (!event || !currentVersion) {
    return NextResponse.json(
      {
        error: "Event not found",
        details: hasPersistentStoreConfig()
          ? "Event/version rows are missing for this id."
          : "Persistent DB is not configured (missing SUPABASE_SERVICE_ROLE_KEY). Dev data may disappear after reload.",
      },
      { status: 404 },
    );
  }

  const [tasks, alerts, availableStaff, assignments, latestChangeView, confirmations] = await Promise.all([
    listEventTasks(id),
    listAlerts(id),
    listAvailableStaffForDate(event.event_date, event.property_id),
    listEventStaffAssignments(id),
    getLatestEventChangeView(id),
    listEventConfirmations(id),
  ]);
  const assignedStaff = (
    await Promise.all(
      assignments.map(async (assignment) => {
        const staff = await getStaffRosterById(assignment.staff_roster_id);
        if (!staff) return null;
        return {
          assignmentId: assignment.id,
          staffRosterId: assignment.staff_roster_id,
          staff_name: staff.staff_name,
          department: staff.department,
          role: staff.role,
          shift_date: staff.shift_date,
          assigned_at: assignment.assigned_at,
        };
      }),
    )
  ).filter((row): row is NonNullable<typeof row> => Boolean(row));
  const profile = loadPropertyProfile(event.property_id);
  return NextResponse.json({
    event,
    parsed: currentVersion.parsed_json,
    tasks,
    alerts,
    availableStaff,
    assignedStaff,
    latestChangeView,
    confirmations,
    staffingCapacity: profile.staffing_capacity ?? { servers: 0, bartenders: 0, kitchen: 0 },
  });
}
