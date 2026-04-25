import { NextResponse } from "next/server";
import type { BriefingLevel } from "@/lib/beo/briefingGenerator";
import { resolveBriefingBundle } from "@/lib/beo/resolveBriefingBundle";

const LEVELS: BriefingLevel[] = ["executive", "management", "department"];

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const levelParam = new URL(request.url).searchParams.get("level");
  const level: BriefingLevel = LEVELS.includes(levelParam as BriefingLevel) ? (levelParam as BriefingLevel) : "management";

  const bundle = await resolveBriefingBundle(id, level);
  if (!bundle) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const { event, sourceVersion, briefingDoc, meta, briefingLocation, alerts } = bundle;
  const briefing = [briefingDoc.headline, briefingDoc.summary].filter(Boolean).join(" ");

  return NextResponse.json({
    briefing,
    briefingDoc,
    level,
    event,
    parsed: sourceVersion.parsed_json,
    alerts,
    operationalChanges: meta.operationalChanges,
    briefingLocation,
    briefingStatus: meta.briefingStatus,
    validation: meta.validation,
    versionMeta: meta.versionMeta,
    persistedPromotion: Boolean(bundle.persistedRow),
    departmentSummaries: bundle.persistedRow?.department_summaries ?? null,
  });
}
