import { runBeoExtraction } from "@/lib/beo/extract";
import { normalizeBeoFields } from "@/lib/beo/normalize";
import { routeBeoForReview } from "@/lib/beo/review";
import { validateBeoRecord } from "@/lib/beo/validate";
import type { NormalizedBeoRecord, RawBeoExtraction, ReviewRoutingResult, ValidationResult } from "@/lib/beo/types";

export type ProcessBeoInput = {
  cleanedText: string;
  timezone?: string;
  model?: string;
};

export type ProcessBeoResult = {
  extraction: RawBeoExtraction;
  normalized: NormalizedBeoRecord;
  validation: ValidationResult;
  routing: ReviewRoutingResult;
};

export async function processBeo({
  cleanedText,
  timezone = "America/Chicago",
  model,
}: ProcessBeoInput): Promise<ProcessBeoResult> {
  const extraction = await runBeoExtraction({
    cleanedText,
    timezone,
    model,
  });

  const normalized = normalizeBeoFields(extraction, {
    defaultTimezone: timezone,
  });

  const validation = validateBeoRecord(normalized);
  const routing = routeBeoForReview(normalized, validation);

  return {
    extraction,
    normalized,
    validation,
    routing,
  };
}
