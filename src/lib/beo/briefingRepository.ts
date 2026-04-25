import type { OperationalChange } from "@/lib/beo/changeDetector";
import { buildBriefingMeta, type BriefingMeta } from "@/lib/beo/briefingMeta";
import type { BriefingLevel, BriefingDepartment, EventBriefing } from "@/lib/beo/briefingGenerator";
import { emptyDepartmentNotes } from "@/lib/beo/briefingGenerator";
import { parsedBEOToNormalized } from "@/lib/beo/parsedBEOToNormalized";
import type { NormalizedBeoRecord, ValidationResult } from "@/lib/beo/types";
import type { AlertRecord, EventRecord, EventVersionRecord } from "@/lib/types";
import {
  getEvent,
  getLatestEventBriefing,
  insertEventBriefing,
  listAlerts,
  listEventVersions,
  type EventBriefingRow,
} from "@/lib/store";

export type { EventBriefingRow };

/**
 * Traceability: each row ties a published manager briefing to the `event_versions` row that produced it.
 */
export async function loadLatestBriefingForEvent(
  eventId: string,
): Promise<EventBriefingRow | null> {
  return getLatestEventBriefing(eventId);
}

export async function savePromotionBriefing(input: {
  eventId: string;
  versionId: string;
  briefingManagement: EventBriefing;
  departmentSummaries: Record<string, string[]>;
  operationalChanges: OperationalChange[];
  validation: ValidationResult;
  promotedBy: string;
}): Promise<EventBriefingRow> {
  return insertEventBriefing({
    event_id: input.eventId,
    version_id: input.versionId,
    briefing_management: input.briefingManagement,
    department_summaries: input.departmentSummaries,
    operational_changes: input.operationalChanges,
    validation: input.validation,
    promoted_by: input.promotedBy,
  });
}

/** Merge department-level notes saved at promotion into the management briefing document. */
export function mergeDepartmentSummariesIntoBriefing(
  briefing: EventBriefing,
  summaries: Record<string, string[]>,
): EventBriefing {
  const departmentNotes = { ...briefing.departmentNotes } as Record<BriefingDepartment, string[]>;
  for (const [key, lines] of Object.entries(summaries)) {
    if (key in departmentNotes) {
      departmentNotes[key as BriefingDepartment] = lines ?? [];
    }
  }
  return { ...briefing, departmentNotes };
}

/** Serves persisted JSON at the requested depth without regenerating from live BEO text. */
export function slicePersistedBriefingForLevel(
  briefing: EventBriefing,
  level: BriefingLevel,
): EventBriefing {
  if (level === "executive") {
    return {
      ...briefing,
      keyFacts: briefing.keyFacts.slice(0, 3),
      timeline: briefing.timeline.slice(0, 3),
      departmentNotes: emptyDepartmentNotes(),
    };
  }
  if (level === "department") {
    return {
      ...briefing,
      summary: "",
      keyFacts: [],
      timeline: briefing.timeline,
      risks: briefing.risks,
      changes: briefing.changes,
      departmentNotes: briefing.departmentNotes,
    };
  }
  return briefing;
}

export function briefingDocFromPersistedRow(
  row: EventBriefingRow,
  level: BriefingLevel,
): EventBriefing {
  const merged = mergeDepartmentSummariesIntoBriefing(
    row.briefing_management,
    row.department_summaries,
  );
  return slicePersistedBriefingForLevel(merged, level);
}

function normalizedFromVersionRow(version: EventVersionRecord): NormalizedBeoRecord {
  const n = version.normalized_json;
  if (n !== null && typeof n === "object" && !Array.isArray(n)) {
    return n as NormalizedBeoRecord;
  }
  return parsedBEOToNormalized(version.parsed_json);
}

export type CommandBriefingPayload = {
  briefingDoc: EventBriefing;
  meta: BriefingMeta;
  briefingLocation: string | null;
  trace: {
    versionId: string;
    versionNumber: number;
    briefingCreatedAt: string;
    promotedBy: string | null;
  };
  event: EventRecord;
};

/** Build command briefing payload from rows already loaded (no extra version list / version-by-id queries). */
export function buildCommandBriefingPayloadFromFetched(opts: {
  event: EventRecord;
  row: EventBriefingRow;
  versions: EventVersionRecord[];
  alerts: AlertRecord[];
}): CommandBriefingPayload | null {
  const { event, row, versions, alerts } = opts;
  const version = versions.find((v) => v.id === row.version_id);
  if (!version) return null;

  const previousVersion =
    versions
      .filter((v) => v.version_number < version.version_number)
      .sort((a, b) => b.version_number - a.version_number)[0] ?? null;

  const normalized = normalizedFromVersionRow(version);
  const previousNorm: NormalizedBeoRecord | null = previousVersion
    ? normalizedFromVersionRow(previousVersion)
    : null;

  const meta = buildBriefingMeta({
    normalized,
    previousNormalized: previousNorm,
    eventStatus: event.status,
    alerts,
    currentVersionNumber: version.version_number,
    previousVersionNumber: previousVersion?.version_number ?? null,
    operationalChangesOverride: row.operational_changes ?? [],
    validationFromPersisted: row.validation ?? null,
  });

  const briefingDoc = briefingDocFromPersistedRow(row, "management");
  const roomLabel = normalized.roomName ?? event.room_name ?? null;
  const briefingLocation = [normalized.propertyName, roomLabel].filter(Boolean).join(" · ") || null;

  return {
    briefingDoc,
    meta,
    briefingLocation,
    trace: {
      versionId: row.version_id,
      versionNumber: version.version_number,
      briefingCreatedAt: row.created_at,
      promotedBy: row.promoted_by,
    },
    event,
  };
}

/**
 * Command-center briefing: only the latest persisted promotion snapshot (no live regeneration).
 */
export async function loadPersistedCommandBriefing(
  eventId: string,
): Promise<CommandBriefingPayload | null> {
  const row = await loadLatestBriefingForEvent(eventId);
  if (!row) return null;

  const [event, versions, alerts] = await Promise.all([
    getEvent(eventId),
    listEventVersions(eventId),
    listAlerts(eventId),
  ]);
  if (!event) return null;

  return buildCommandBriefingPayloadFromFetched({ event, row, versions, alerts });
}
