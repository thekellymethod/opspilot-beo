import { briefingDocFromPersistedRow } from "@/lib/beo/briefingRepository";
import { buildBriefingMeta, type BriefingMeta } from "@/lib/beo/briefingMeta";
import { generateBriefing, type BriefingLevel, type EventBriefing } from "@/lib/beo/briefingGenerator";
import { parsedBEOToNormalized } from "@/lib/beo/parsedBEOToNormalized";
import type { NormalizedBeoRecord } from "@/lib/beo/types";
import type { AlertRecord, EventRecord, EventVersionRecord } from "@/lib/types";
import {
  getEvent,
  getEventVersionById,
  getLatestEventBriefing,
  getPinnedOrLatestVersion,
  getPriorVersionByNumber,
  listAlerts,
  type EventBriefingRow,
} from "@/lib/store";

export type BriefingBundle = {
  event: EventRecord;
  sourceVersion: EventVersionRecord;
  normalized: NormalizedBeoRecord;
  meta: BriefingMeta;
  briefingDoc: EventBriefing;
  briefingLocation: string | null;
  persistedRow: EventBriefingRow | null;
  alerts: AlertRecord[];
};

function normalizedFromVersionRow(version: EventVersionRecord): NormalizedBeoRecord {
  const n = version.normalized_json;
  if (n !== null && typeof n === "object" && !Array.isArray(n)) {
    return n as NormalizedBeoRecord;
  }
  return parsedBEOToNormalized(version.parsed_json);
}

/**
 * Shared resolver: prefers the latest persisted promotion snapshot when present,
 * otherwise derives from the pinned (or latest) event version and chronological prior version.
 */
export async function resolveBriefingBundle(
  eventId: string,
  level: BriefingLevel,
): Promise<BriefingBundle | null> {
  const event = await getEvent(eventId);
  if (!event) return null;

  const persisted = await getLatestEventBriefing(eventId);
  const sourceVersion = persisted
    ? (await getEventVersionById(persisted.version_id)) ?? (await getPinnedOrLatestVersion(eventId))
    : await getPinnedOrLatestVersion(eventId);

  if (!sourceVersion) return null;

  const normalized = normalizedFromVersionRow(sourceVersion);
  const previousVersion = await getPriorVersionByNumber(eventId, sourceVersion.version_number);
  const previousNorm: NormalizedBeoRecord | null = previousVersion
    ? normalizedFromVersionRow(previousVersion)
    : null;

  const alerts = await listAlerts(eventId);

  const meta = buildBriefingMeta({
    normalized,
    previousNormalized: previousNorm,
    eventStatus: event.status,
    alerts,
    currentVersionNumber: sourceVersion.version_number,
    previousVersionNumber: previousVersion?.version_number ?? null,
    operationalChangesOverride: persisted ? persisted.operational_changes ?? [] : null,
    validationFromPersisted: persisted?.validation ?? null,
  });

  const briefingDoc: EventBriefing = persisted
    ? briefingDocFromPersistedRow(persisted, level)
    : generateBriefing(normalized, meta.operationalChanges, { eventId, level });

  const roomLabel = normalized.roomName ?? event.room_name ?? null;
  const briefingLocation = [normalized.propertyName, roomLabel].filter(Boolean).join(" · ") || null;

  return {
    event,
    sourceVersion,
    normalized,
    meta,
    briefingDoc,
    briefingLocation,
    persistedRow: persisted,
    alerts,
  };
}
