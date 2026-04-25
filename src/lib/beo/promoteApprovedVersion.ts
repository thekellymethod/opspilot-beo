import type { OperationalChange } from "@/lib/beo/changeDetector";
import { detectOperationalChanges } from "@/lib/beo/changeDetector";
import { generateBriefing, type EventBriefing } from "@/lib/beo/briefingGenerator";
import { generatedTasksToEventTaskRecords } from "@/lib/beo/mapToPersistence";
import { parsedBEOToNormalized } from "@/lib/beo/parsedBEOToNormalized";
import { generateTasks } from "@/lib/beo/taskGenerator";
import type { NormalizedBeoRecord } from "@/lib/beo/types";
import { validateBeoRecord } from "@/lib/beo/validate";
import type { EventTaskRecord, EventVersionRecord } from "@/lib/types";
import { savePromotionBriefing } from "@/lib/beo/briefingRepository";
import {
  appendEventActivities,
  archivePendingTasksForEvent,
  getEvent,
  getEventVersionById,
  insertEventTasks,
  setEventCurrentVersion,
} from "@/lib/store";

export type PromoteApprovedVersionInput = {
  eventId: string;
  versionId: string;
  approvedBy: string;
};

export type PromoteApprovedVersionResult = {
  briefing: EventBriefing;
  tasks: EventTaskRecord[];
  changes: OperationalChange[];
  version: EventVersionRecord;
};

export class PromoteApprovedVersionError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "PromoteApprovedVersionError";
  }
}

function normalizedFromVersion(version: EventVersionRecord): NormalizedBeoRecord | null {
  const raw = version.normalized_json;
  if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as NormalizedBeoRecord;
  }
  return null;
}

/**
 * Promotes an approved BEO version to the live operational state for an event:
 * pins `current_version_id`, diffs vs the prior pinned version, archives open tasks,
 * inserts regenerated tasks, persists management + department briefings, and logs activity.
 *
 * Ordering is deterministic; Supabase has no multi-statement transaction wrapper here,
 * so callers should treat partial failures as requiring manual reconciliation (rare).
 */
export async function promoteApprovedVersion(
  input: PromoteApprovedVersionInput,
): Promise<PromoteApprovedVersionResult> {
  const { eventId, versionId, approvedBy } = input;
  const trimmedBy = approvedBy.trim() || "unknown";

  const event = await getEvent(eventId);
  if (!event) {
    throw new PromoteApprovedVersionError("Event not found.", 404);
  }

  const version = await getEventVersionById(versionId);
  if (!version || version.event_id !== eventId) {
    throw new PromoteApprovedVersionError("Version not found for this event.", 404);
  }

  const currentNorm = normalizedFromVersion(version);
  if (!currentNorm) {
    throw new PromoteApprovedVersionError(
      "This version has no normalized record. Complete normalization before promotion.",
      400,
    );
  }

  const previousVersionId = event.current_version_id;
  const previousVersion =
    previousVersionId && previousVersionId !== versionId
      ? await getEventVersionById(previousVersionId)
      : null;

  const previousNorm: NormalizedBeoRecord | null =
    previousVersion && previousVersion.event_id === eventId
      ? normalizedFromVersion(previousVersion) ??
        parsedBEOToNormalized(previousVersion.parsed_json)
      : null;

  const changes: OperationalChange[] = previousNorm
    ? detectOperationalChanges(previousNorm, currentNorm)
    : [];

  await setEventCurrentVersion(eventId, versionId);

  await archivePendingTasksForEvent(eventId);

  const generated = generateTasks(currentNorm, { eventId });
  const taskRows = generatedTasksToEventTaskRecords(eventId, generated);
  await insertEventTasks(taskRows);

  const briefingManagement = generateBriefing(currentNorm, changes, {
    eventId,
    level: "management",
  });
  const briefingDepartment = generateBriefing(currentNorm, changes, {
    eventId,
    level: "department",
  });

  const departmentSummaries: Record<string, string[]> = {};
  for (const [dept, notes] of Object.entries(briefingDepartment.departmentNotes)) {
    departmentSummaries[dept] = notes;
  }

  const validation = validateBeoRecord(currentNorm);

  await savePromotionBriefing({
    eventId,
    versionId,
    briefingManagement: briefingManagement,
    departmentSummaries: departmentSummaries,
    operationalChanges: changes,
    validation,
    promotedBy: trimmedBy,
  });

  await appendEventActivities([
    {
      event_id: eventId,
      actor_label: trimmedBy,
      action: "version_promoted",
      details: {
        versionId,
        previousVersionId: previousVersionId ?? null,
        versionNumber: version.version_number,
      },
    },
    {
      event_id: eventId,
      actor_label: trimmedBy,
      action: "tasks_regenerated",
      details: { inserted: taskRows.length, archivedPending: true },
    },
    {
      event_id: eventId,
      actor_label: trimmedBy,
      action: "briefing_published",
      details: { versionId, managementHeadline: briefingManagement.headline },
    },
  ]);

  return {
    briefing: briefingManagement,
    tasks: taskRows,
    changes,
    version,
  };
}
