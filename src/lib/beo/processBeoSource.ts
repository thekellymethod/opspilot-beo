import { cleanBeoText } from "@/lib/beo/cleanBeoText";
import { extractPdfTextForBeo } from "@/lib/beo/extractPdfTextForBeo";
import { loadPropertyProfile } from "@/lib/beo/propertyProfile";
import { BEO_EXTRACTION_PROMPT_VERSION } from "@/lib/beo/prompt";
import { processBeo } from "@/lib/beo/process";
import type { ProcessBeoSourceResult } from "@/lib/beo/types";
import { normalizedToParsedBEO } from "@/lib/beo/toParsedBEO";
import { getBeoSource, promoteSourceToLiveEvent, updateBeoSource } from "@/lib/beo/sourceStore";
import { saveVersion } from "@/lib/store";

export interface ProcessBeoSourceOptions {
  /** PDF bytes when source_type is pdf and raw text not yet stored. */
  pdfBuffer?: Buffer | null;
}

/**
 * Controlled transformation pipeline: raw text → cleanup → AI (schema-bound) → normalize → validate → route.
 * Even when review is required, persist a draft event version for reference/traceability.
 */
export async function processBeoSource(sourceId: string, options: ProcessBeoSourceOptions = {}): Promise<ProcessBeoSourceResult> {
  let source = await getBeoSource(sourceId);
  if (!source) {
    throw new Error(`Source not found: ${sourceId}`);
  }

  const profile = loadPropertyProfile(source.property_id);

  try {
    if (source.raw_text_status === "pending") {
      if (source.source_type === "pdf" && options.pdfBuffer) {
        const extracted = await extractPdfTextForBeo(options.pdfBuffer);
        source = await updateBeoSource(sourceId, {
          raw_text: extracted.text,
          raw_text_status: "complete",
          parse_status: "extracting",
        });
      } else if (source.source_type === "email_text" && source.raw_text.trim()) {
        source = await updateBeoSource(sourceId, {
          raw_text_status: "complete",
          parse_status: "extracting",
        });
      } else {
        throw new Error("Cannot extract raw text: provide pdfBuffer for PDF sources or pre-filled text for email sources.");
      }
    }

    const cleaned = cleanBeoText(source.raw_text);

    const { extraction, normalized, validation, routing } = await processBeo({
      cleanedText: cleaned,
      timezone: profile.timezone,
    });

    const validationClean =
      validation.isValid &&
      validation.errors.length === 0 &&
      validation.warnings.length === 0 &&
      validation.requiresHumanReview === false;
    const needsReview = !routing.autoApprove && !validationClean;

    source = await updateBeoSource(sourceId, {
      cleaned_text: cleaned,
      latest_ai_extraction: extraction,
      latest_normalized: normalized,
      latest_validation: validation,
      prompt_version: BEO_EXTRACTION_PROMPT_VERSION,
      parse_status: needsReview ? "review_required" : "complete",
      requires_human_review: needsReview,
    });

    if (needsReview) {
      const parsed = normalizedToParsedBEO(normalized);
      const { event, version } = await saveVersion({
        rawText: source.raw_text,
        parsed,
        normalized,
        sourceUrl: source.storage_url ?? null,
        eventIdHint: source.linked_event_id ?? undefined,
      });
      const updated = await updateBeoSource(sourceId, {
        linked_event_id: event.id,
        parse_status: "review_required",
        requires_human_review: true,
      });
      return { status: "review_required", source: updated, validation, normalized, event, version };
    }

    const parsed = normalizedToParsedBEO(normalized);
    const latest = (await getBeoSource(sourceId))!;
    const { event, version } = await promoteSourceToLiveEvent(sourceId, {
      rawText: latest.raw_text,
      cleanedText: cleaned,
      parsed,
      normalized,
      validation,
    });

    const finalSource = (await getBeoSource(sourceId))!;
    return { status: "approved", source: finalSource, event, version };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    await updateBeoSource(sourceId, {
      parse_status: "failed",
      raw_text_status: source.raw_text_status === "pending" ? "failed" : source.raw_text_status,
    });
    const failed = (await getBeoSource(sourceId))!;
    return { status: "failed", source: failed, error: message };
  }
}
