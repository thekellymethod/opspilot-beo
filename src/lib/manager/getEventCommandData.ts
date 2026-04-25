import type { OperationalChange } from "@/lib/beo/changeDetector";
import type { CommandBriefingPayload } from "@/lib/beo/briefingRepository";
import { buildCommandBriefingPayloadFromFetched } from "@/lib/beo/briefingRepository";
import { evaluateReadinessFromFetched, isCriticalOperationalTask } from "@/lib/beo/readiness";
import type { EventReadinessSnapshot, EventRecord, EventTaskRecord } from "@/lib/types";
import type { EventActivityRow } from "@/lib/store";
import {
  getEvent,
  getLatestEventBriefing,
  listAlerts,
  listEventAcknowledgments,
  listEventActivity,
  listEventTasks,
  listEventVersions,
} from "@/lib/store";

const DEPT_ORDER = ["kitchen", "banquets", "bar"] as const;

export type AcknowledgmentRow = Awaited<ReturnType<typeof listEventAcknowledgments>>[number];

export type DepartmentCommandRow = {
  department: string;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  taskTotal: number;
  taskCompleted: number;
  taskPending: number;
  criticalOpenTitles: string[];
};

function aggregateByDepartment(tasks: EventTaskRecord[]) {
  const map = new Map<
    string,
    { tasks: EventTaskRecord[]; pending: EventTaskRecord[]; criticalPending: EventTaskRecord[] }
  >();
  for (const t of tasks) {
    if (!map.has(t.department)) {
      map.set(t.department, { tasks: [], pending: [], criticalPending: [] });
    }
    const bucket = map.get(t.department)!;
    bucket.tasks.push(t);
    if (t.status === "pending") {
      bucket.pending.push(t);
      if (isCriticalOperationalTask(t.title, t.checklist)) {
        bucket.criticalPending.push(t);
      }
    }
  }
  return map;
}

function buildDepartmentRows(
  byDept: ReturnType<typeof aggregateByDepartment>,
  acks: AcknowledgmentRow[],
): DepartmentCommandRow[] {
  const deptKeys = Array.from(
    new Set([...byDept.keys(), ...acks.map((a) => a.department.toLowerCase())]),
  ).sort((a, b) => {
    const ia = DEPT_ORDER.indexOf(a as (typeof DEPT_ORDER)[number]);
    const ib = DEPT_ORDER.indexOf(b as (typeof DEPT_ORDER)[number]);
    const sa = ia === -1 ? 99 : ia;
    const sb = ib === -1 ? 99 : ib;
    if (sa !== sb) return sa - sb;
    return a.localeCompare(b);
  });

  return deptKeys.map((dept) => {
    const bucket = byDept.get(dept);
    const total = bucket?.tasks.length ?? 0;
    const completed = bucket ? bucket.tasks.filter((t) => t.status === "complete").length : 0;
    const pending = bucket?.pending.length ?? 0;
    const crit = bucket?.criticalPending.map((t) => t.title) ?? [];
    const ack = acks.find((a) => a.department.toLowerCase() === dept.toLowerCase());
    return {
      department: dept,
      acknowledged: Boolean(ack?.acknowledged),
      acknowledgedAt: ack?.acknowledged_at ?? null,
      taskTotal: total,
      taskCompleted: completed,
      taskPending: pending,
      criticalOpenTitles: crit,
    };
  });
}

export type EventCommandData = {
  event: EventRecord;
  briefing: CommandBriefingPayload | null;
  operationalChanges: OperationalChange[];
  tasks: EventTaskRecord[];
  acknowledgments: AcknowledgmentRow[];
  activity: EventActivityRow[];
  readiness: EventReadinessSnapshot;
  departmentRows: DepartmentCommandRow[];
  pinnedVersionId: string | null;
  reviewHref: string;
};

export async function getEventCommandData(eventId: string): Promise<EventCommandData | null> {
  const event = await getEvent(eventId);
  if (!event) return null;

  const [briefingRow, versions, tasks, activity, acks, alerts] = await Promise.all([
    getLatestEventBriefing(eventId),
    listEventVersions(eventId),
    listEventTasks(eventId, { includeArchived: false }),
    listEventActivity(eventId, 40),
    listEventAcknowledgments(eventId),
    listAlerts(eventId),
  ]);

  const briefingPayload = briefingRow
    ? buildCommandBriefingPayloadFromFetched({ event, row: briefingRow, versions, alerts })
    : null;

  const readiness = evaluateReadinessFromFetched(briefingRow, tasks, acks, alerts);

  const pinned = event.current_version_id
    ? versions.find((v) => v.id === event.current_version_id) ?? versions[0]
    : versions[0];

  const reviewHref =
    pinned?.id != null
      ? `/dashboard/events/${eventId}/versions/${pinned.id}/review`
      : `/dashboard/events/${eventId}/review`;

  const byDept = aggregateByDepartment(tasks);
  const departmentRows = buildDepartmentRows(byDept, acks);

  return {
    event,
    briefing: briefingPayload,
    operationalChanges:
      briefingPayload?.meta.operationalChanges ?? briefingRow?.operational_changes ?? [],
    tasks,
    acknowledgments: acks,
    activity,
    readiness,
    departmentRows,
    pinnedVersionId: pinned?.id ?? null,
    reviewHref,
  };
}
