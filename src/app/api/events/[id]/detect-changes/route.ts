import { NextResponse } from "next/server";
import { detectOperationalChanges } from "@/lib/beo/changeDetector";
import { operationalChangesToAlerts } from "@/lib/beo/mapToPersistence";
import { parsedBEOToNormalized } from "@/lib/beo/parsedBEOToNormalized";
import type { NormalizedBeoRecord } from "@/lib/beo/types";
import { createAlerts, getLatestVersion, getPreviousVersion } from "@/lib/store";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const latest = await getLatestVersion(id);
  const previous = await getPreviousVersion(id);

  if (!latest || !previous) {
    return NextResponse.json({ alerts: [], changes: [], note: "At least two versions are required for comparison." });
  }

  const prevNorm =
    (previous.normalized_json as NormalizedBeoRecord | undefined) ?? parsedBEOToNormalized(previous.parsed_json);
  const currNorm = (latest.normalized_json as NormalizedBeoRecord | undefined) ?? parsedBEOToNormalized(latest.parsed_json);

  const changes = detectOperationalChanges(prevNorm, currNorm);
  const alerts = operationalChangesToAlerts(id, changes);
  const savedAlerts = await createAlerts(alerts);
  return NextResponse.json({ alerts: savedAlerts, changes });
}
