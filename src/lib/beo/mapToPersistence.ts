import type { OperationalChange } from "@/lib/beo/changeDetector";
import type { GeneratedTask, TaskDepartment } from "@/lib/beo/taskGenerator";
import type { AlertRecord, Department, EventTaskRecord } from "@/lib/types";

function mapTaskDepartmentToDb(d: TaskDepartment): Department {
  if (d === "kitchen") return "kitchen";
  if (d === "bar") return "bar";
  return "banquets";
}

function parseDueAt(dueAt: string | null): string | null {
  if (!dueAt) return null;
  const t = Date.parse(dueAt);
  if (!Number.isNaN(t)) return new Date(t).toISOString();
  return null;
}

export function generatedTasksToEventTaskRecords(eventId: string, tasks: GeneratedTask[]): EventTaskRecord[] {
  return tasks.map((task) => ({
    id: crypto.randomUUID(),
    event_id: eventId,
    department: mapTaskDepartmentToDb(task.department),
    title: task.department !== "banquets" && task.department !== "kitchen" && task.department !== "bar"
      ? `[${task.department}] ${task.title}`
      : task.title,
    due_at: parseDueAt(task.dueAt),
    checklist: [`Rule: ${task.sourceRule}`, task.description, ...task.checklist],
    status: "pending" as const,
  }));
}

function mapImpactToDepartments(deps: OperationalChange["affectedDepartments"]): Department[] {
  const set = new Set<Department>();
  for (const d of deps) {
    if (d === "kitchen") set.add("kitchen");
    else if (d === "bar") set.add("bar");
    else set.add("banquets");
  }
  return Array.from(set);
}

export function operationalChangesToAlerts(eventId: string, changes: OperationalChange[]): AlertRecord[] {
  return changes.map((c) => ({
    id: crypto.randomUUID(),
    event_id: eventId,
    severity: c.severity,
    message: `${c.title}: ${c.message}`,
    affected_departments: mapImpactToDepartments(c.affectedDepartments),
    resolved: false,
    created_at: new Date().toISOString(),
  }));
}
