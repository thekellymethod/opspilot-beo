import { NextResponse } from "next/server";
import { processBeoSource } from "@/lib/beo/processBeoSource";
import { createBeoSource } from "@/lib/beo/sourceStore";

export const runtime = "nodejs";

/** Runs the full controlled pipeline on pasted text (immutable source row for traceability). */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawText = String(body?.rawText ?? "").trim();
    if (!rawText) {
      return NextResponse.json({ error: "rawText is required" }, { status: 400 });
    }

    const propertyId = body?.property_id != null ? String(body.property_id) : null;
    const uploadedBy = body?.uploaded_by != null ? String(body.uploaded_by) : null;

    const source = await createBeoSource({
      source_type: "email_text",
      property_id: propertyId,
      uploaded_by: uploadedBy,
      raw_text: rawText,
      raw_text_status: "complete",
    });

    const result = await processBeoSource(source.id);
    if (result.status === "approved") {
      return NextResponse.json({
        status: result.status,
        sourceId: source.id,
        event: result.event,
        version: result.version,
      });
    }
    if (result.status === "review_required") {
      return NextResponse.json({
        status: result.status,
        sourceId: source.id,
        validation: result.validation,
        normalized: result.source.latest_normalized,
        ai: result.source.latest_ai_extraction,
      });
    }
    return NextResponse.json(
      { status: result.status, sourceId: source.id, error: result.error, source: result.source },
      { status: 422 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to parse BEO", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
