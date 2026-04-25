import { randomUUID } from "crypto";
import type { EventTaskRecord } from "@/lib/types";
import { getEventTaskById, listEventTasks, updateEventTask } from "@/lib/store";
import type {
  BriefingAcknowledgmentInput,
  CompleteTaskInput,
  ShiftEventInput,
  ShiftEventRecord,
  StaffTaskRecord,
} from "./types";

const mockAcknowledgments = new Map<
  string,
  {
    eventId: string;
    department: string;
    acknowledged: boolean;
    acknowledgedAt: string | null;
    acknowledgedBy: string | null;
    employeeId: string | null;
  }
>();

const mockShiftEvents: ShiftEventRecord[] = [];

function makeAckKey(eventId: string, department: string): string {
  return `${eventId}:${department.toLowerCase()}`;
}

export async function acknowledgeBriefing(input: BriefingAcknowledgmentInput) {
  const now = new Date().toISOString();
  const key = makeAckKey(input.eventId, input.department);

  const record = {
    eventId: input.eventId,
    department: input.department,
    acknowledged: true,
    acknowledgedAt: now,
    acknowledgedBy: input.acknowledgedBy,
    employeeId: input.employeeId,
  };

  mockAcknowledgments.set(key, record);
  return record;
}

function mapDbTaskToStaff(row: EventTaskRecord): StaffTaskRecord {
  const checklist = Array.isArray(row.checklist) ? row.checklist : [];
  const description =
    checklist.length > 1 ? checklist.slice(1).join("\n").trim() : checklist[0] ?? row.title;

  return {
    id: row.id,
    eventId: row.event_id,
    department: row.department,
    title: row.title,
    description,
    status: row.status === "complete" ? "completed" : "pending",
    assignedToEmployeeId: null,
    completedAt: null,
    completedByEmployeeId: null,
  };
}

export async function findTaskById(taskId: string): Promise<StaffTaskRecord | null> {
  const row = await getEventTaskById(taskId);
  if (!row || row.archived) return null;
  return mapDbTaskToStaff(row);
}

export async function completeTask(
  input: CompleteTaskInput,
): Promise<StaffTaskRecord | null> {
  const updated = await updateEventTask(input.taskId, { status: "complete" });
  if (!updated) return null;
  return mapDbTaskToStaff(updated);
}

export async function recordShiftEvent(
  input: ShiftEventInput,
): Promise<ShiftEventRecord> {
  const record: ShiftEventRecord = {
    id: randomUUID(),
    eventId: input.eventId,
    employeeId: input.employeeId,
    eventType: input.eventType,
    createdAt: new Date().toISOString(),
    note: input.note ?? null,
  };

  mockShiftEvents.push(record);
  return record;
}

export async function listTasksForEventAndDepartment(params: {
  eventId: string;
  department: string;
}): Promise<StaffTaskRecord[]> {
  const rows = await listEventTasks(params.eventId, { includeArchived: false });
  const dept = params.department.trim().toLowerCase();
  return rows
    .filter((t) => t.department.toLowerCase() === dept)
    .map(mapDbTaskToStaff);
}
