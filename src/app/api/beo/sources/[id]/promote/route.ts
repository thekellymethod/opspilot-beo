import { NextResponse } from "next/server";
import { routeBeoForReview } from "@/lib/beo/review";
import { getBeoSource, promoteSourceToLiveEvent, updateBeoSource } from "@/lib/beo/sourceStore";
import { normalizedToParsedBEO } from "@/lib/beo/toParsedBEO";
import type { NormalizedBeoRecord } from "@/lib/beo/types";
import { validateBeoRecord } from "@/lib/beo/validate";

export const runtime = "nodejs";

/**
 * Promote a reviewed parse to a live event version.
 * Body: `{ "humanApproved": true }` skips automatic review routing once (manager accepts residual risk).
 * Optional `normalized` partial object merges corrections before re-validation.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const humanApproved = Boolean(body?.humanApproved);

  const source = await getBeoSource(id);
  if (!source) {
    return NextResponse.json({ error: "BEO source not found.", hint: "Check the source id matches the upload response." }, { status: 404 });
  }
  if (!source.latest_normalized) {
    return NextResponse.json(
      {
        error: "Intake did not produce a normalized record for this source yet.",
        parse_status: source.parse_status,
        raw_text_status: source.raw_text_status,
        hint:
          source.parse_status === "failed"
            ? "Fix the upload (PDF/text) and run the pipeline again; promotion needs a successful extract + normalize step."
            : "Wait for processing to finish, or re-run BEO intake so latest_normalized is saved before promoting.",
      },
      { status: 400 },
    );
  }

  let normalized: NormalizedBeoRecord = { ...source.latest_normalized };
  if (body?.normalized && typeof body.normalized === "object") {
    normalized = { ...normalized, ...body.normalized } as NormalizedBeoRecord;
  }

  const validation = validateBeoRecord(normalized);
  await updateBeoSource(id, {
    latest_normalized: normalized,
    latest_validation: validation,
  });

  const routing = routeBeoForReview(normalized, validation);

  if (!routing.autoApprove && !humanApproved) {
    return NextResponse.json(
      {
        error: "Review still required",
        validation,
        routing,
        hint: "Send { humanApproved: true } after manager sign-off, or merge corrections in normalized and retry.",
      },
      { status: 409 },
    );
  }

  const parsed = normalizedToParsedBEO(normalized);
  const { event, version } = await promoteSourceToLiveEvent(id, {
    rawText: source.raw_text,
    cleanedText: source.cleaned_text ?? source.raw_text,
    parsed,
    normalized,
    validation,
  });

  return NextResponse.json({ status: "approved", event, version });
}
