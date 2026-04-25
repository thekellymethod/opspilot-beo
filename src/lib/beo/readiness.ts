import type { OperationalChange } from "@/lib/beo/changeDetector";
import type { AlertRecord, EventReadinessSnapshot, EventTaskRecord } from "@/lib/types";
import type { EventBriefingRow } from "@/lib/store";
import {
  getLatestEventBriefing,
  listAlerts,
  listEventAcknowledgments,
  listEventTasks,
  updateEventReadiness,
} from "@/lib/store";

const CORE_DEPTS = ["kitchen", "banquets", "bar", "management"] as const;

export function isCriticalOperationalTask(title: string, checklist: string[]): boolean {
  const blob = `${title}\n${checklist.join("\n")}`.toLowerCase();
  return (
    /\ballergy\b|\banaphylaxis\b|\bnut\b|\bgluten\b|\bvegan\b|\bkosher\b|\bhalal\b|\bmedical\b/.test(blob) ||
    /\bvip\b|\bsecurity\b|\bpolice\b/.test(blob)
  );
}

export type ReadinessInputs = {
  operationalChanges: OperationalChange[];
  validationSeverity: string;
  acknowledgments: Array<{
    department: string;
    acknowledged: boolean;
  }>;
  tasksByDepartment: Record<
    string,
    {
      total: number;
      pending: number;
      criticalPending: number;
    }
  >;
  hasOpenCriticalOrHighAlert: boolean;
};

/**
 * Deterministic 0–100 score and discrete level for the command center.
 * Not a predictive model — explicit operational gates only.
 */
export function computeEventReadiness(input: ReadinessInputs): EventReadinessSnapshot {
  let score = 100;
  const reasons: string[] = [];

  for (const change of input.operationalChanges) {
    if (change.severity === "critical") {
      score -= 15;
      reasons.push(`Critical change: ${change.title}`);
    } else if (change.severity === "high") {
      score -= 8;
      reasons.push(`High-impact change: ${change.title}`);
    } else if (change.severity === "medium") {
      score -= 3;
    }
  }

  if (input.validationSeverity === "review_required") {
    score -= 25;
    reasons.push("Validation requires review before execution.");
  } else if (input.validationSeverity === "warning") {
    score -= 8;
    reasons.push("Validation warnings are present.");
  }

  if (input.hasOpenCriticalOrHighAlert) {
    score -= 20;
    reasons.push("Unresolved critical or high alerts.");
  }

  if (input.acknowledgments.length > 0) {
    const ackByDept = new Map(
      input.acknowledgments.map((a) => [a.department.toLowerCase(), a]),
    );
    for (const dept of CORE_DEPTS) {
      const row = ackByDept.get(dept);
      if (!row || !row.acknowledged) {
        score -= 10;
        reasons.push(`Department "${dept}" has not acknowledged the briefing.`);
      }
    }
  }

  for (const [dept, stats] of Object.entries(input.tasksByDepartment)) {
    if (stats.criticalPending > 0) {
      score -= 12;
      reasons.push(`${dept}: ${stats.criticalPending} critical task(s) still open.`);
    } else if (stats.pending > 0 && stats.total > 0) {
      score -= 4;
      reasons.push(`${dept}: ${stats.pending} task(s) pending.`);
    }
  }

  score = Math.max(0, Math.min(100, score));

  let level: EventReadinessSnapshot["level"] = "ready";
  if (score < 40) level = "blocked";
  else if (score < 75) level = "attention";

  return {
    score,
    level,
    reasons: Array.from(new Set(reasons)).slice(0, 12),
    computed_at: new Date().toISOString(),
  };
}

function aggregateTasksByDepartment(
  tasks: Awaited<ReturnType<typeof listEventTasks>>,
): ReadinessInputs["tasksByDepartment"] {
  const map: ReadinessInputs["tasksByDepartment"] = {};
  for (const t of tasks) {
    const d = t.department;
    if (!map[d]) map[d] = { total: 0, pending: 0, criticalPending: 0 };
    map[d].total += 1;
    if (t.status === "pending") {
      map[d].pending += 1;
      if (isCriticalOperationalTask(t.title, t.checklist)) {
        map[d].criticalPending += 1;
      }
    }
  }
  return map;
}

export type AcknowledgmentReadinessRow = {
  department: string;
  acknowledged: boolean;
};

/** Build readiness inputs from data already loaded for the event (avoids duplicate store round-trips). */
export function buildReadinessInputsFromFetched(
  briefingRow: EventBriefingRow | null,
  tasks: EventTaskRecord[],
  acks: AcknowledgmentReadinessRow[],
  alerts: AlertRecord[],
): ReadinessInputs {
  const operationalChanges = briefingRow?.operational_changes ?? [];
  const validationSeverity = briefingRow?.validation?.severity ?? "ok";
  const hasOpenCriticalOrHighAlert = alerts.some(
    (a) => !a.resolved && (a.severity === "critical" || a.severity === "high"),
  );
  return {
    operationalChanges,
    validationSeverity,
    acknowledgments: acks.map((a) => ({
      department: a.department,
      acknowledged: a.acknowledged,
    })),
    tasksByDepartment: aggregateTasksByDepartment(tasks),
    hasOpenCriticalOrHighAlert,
  };
}

export function evaluateReadinessFromFetched(
  briefingRow: EventBriefingRow | null,
  tasks: EventTaskRecord[],
  acks: AcknowledgmentReadinessRow[],
  alerts: AlertRecord[],
): EventReadinessSnapshot {
  return computeEventReadiness(buildReadinessInputsFromFetched(briefingRow, tasks, acks, alerts));
}

async function gatherReadinessInputs(eventId: string): Promise<ReadinessInputs> {
  const [briefingRow, tasks, acks, alerts] = await Promise.all([
    getLatestEventBriefing(eventId),
    listEventTasks(eventId, { includeArchived: false }),
    listEventAcknowledgments(eventId),
    listAlerts(eventId),
  ]);
  return buildReadinessInputsFromFetched(briefingRow, tasks, acks, alerts);
}

/** Live rule-based readiness for the command center (no persistence). */
export async function evaluateReadinessForEvent(eventId: string): Promise<EventReadinessSnapshot> {
  return computeEventReadiness(await gatherReadinessInputs(eventId));
}

export async function computeAndPersistReadiness(eventId: string): Promise<EventReadinessSnapshot> {
  const snapshot = await evaluateReadinessForEvent(eventId);
  await updateEventReadiness(eventId, snapshot);
  return snapshot;
}
