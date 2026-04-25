import { NextResponse } from "next/server";
import { processBeoSource } from "@/lib/beo/processBeoSource";
import { createBeoSource } from "@/lib/beo/sourceStore";

/** pdf-parse / pdfjs-dist require Node (native Buffer, file APIs). */
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const propertyId = typeof formData.get("property_id") === "string" ? String(formData.get("property_id")) : null;
    const uploadedBy = typeof formData.get("uploaded_by") === "string" ? String(formData.get("uploaded_by")) : null;
    const sender = typeof formData.get("sender") === "string" ? String(formData.get("sender")) : null;
    const linkedEventId = typeof formData.get("linked_event_id") === "string" ? String(formData.get("linked_event_id")) : null;
    const revisionRaw = formData.get("revision_sequence");
    const revisionSequence =
      typeof revisionRaw === "string" && revisionRaw.trim() ? Number.parseInt(revisionRaw, 10) : null;

    const pastedText = formData.get("text");
    const fileEntry = formData.get("file");

    if (fileEntry instanceof File && fileEntry.size > 0) {
      const buffer = Buffer.from(await fileEntry.arrayBuffer());
      const source = await createBeoSource({
        source_type: "pdf",
        filename: fileEntry.name,
        property_id: propertyId,
        uploaded_by: uploadedBy,
        sender,
        linked_event_id: linkedEventId,
        revision_sequence: Number.isFinite(revisionSequence) ? revisionSequence : null,
        raw_text: "",
        raw_text_status: "pending",
        storage_url: null,
      });
      const result = await processBeoSource(source.id, { pdfBuffer: buffer });
      return NextResponse.json({ sourceId: source.id, ...result });
    }

    if (typeof pastedText === "string" && pastedText.trim()) {
      const source = await createBeoSource({
        source_type: "email_text",
        filename: null,
        property_id: propertyId,
        uploaded_by: uploadedBy,
        sender,
        linked_event_id: linkedEventId,
        revision_sequence: Number.isFinite(revisionSequence) ? revisionSequence : null,
        raw_text: pastedText.trim(),
        raw_text_status: "complete",
      });
      const result = await processBeoSource(source.id);
      return NextResponse.json({ sourceId: source.id, ...result });
    }

    return NextResponse.json({ error: "Provide a PDF file or pasted BEO text." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const isClientPayload =
      message.includes("Provide a PDF") || message.includes("beo_sources insert failed");
    return NextResponse.json(
      { error: "Upload failed", details: message },
      { status: isClientPayload ? 400 : 500 },
    );
  }
}
