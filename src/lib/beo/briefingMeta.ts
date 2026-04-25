import { detectOperationalChanges, type OperationalChange } from "@/lib/beo/changeDetector";
import type { NormalizedBeoRecord, ValidationResult } from "@/lib/beo/types";
import { validateBeoRecord } from "@/lib/beo/validate";
import type { AlertRecord } from "@/lib/types";

export type BriefingUiStatus = "draft" | "review" | "approved" | "live";

export type BriefingVersionMeta = {
  currentVersion: number | null;
  previousVersion: number | null;
};

export type BriefingValidationSummary = {
  severity: ValidationResult["severity"];
  requiresHumanReview: boolean;
  errorCount: number;
  warningCount: number;
};

export function mapAlertsToBriefingStatus(eventStatus: string, alerts: AlertRecord[]): BriefingUiStatus {
  const unresolvedAttention = alerts.some(
    (a) => !a.resolved && (a.severity === "critical" || a.severity === "high"),
  );
  if (unresolvedAttention) return "review";
  const s = eventStatus.toLowerCase();
  if (s === "active") return "live";
  if (s === "draft") return "draft";
  return "approved";
}

/** Errors force review badge; warnings stay on base status but still surface in the validation banner. */
export function mergeStatusWithValidation(base: BriefingUiStatus, validation: BriefingValidationSummary): BriefingUiStatus {
  if (validation.severity === "review_required") return "review";
  return base;
}

export function summarizeValidation(record: NormalizedBeoRecord): BriefingValidationSummary {
  const v = validateBeoRecord(record);
  return {
    severity: v.severity,
    requiresHumanReview: v.requiresHumanReview,
    errorCount: v.errors.length,
    warningCount: v.warnings.length,
  };
}

export type BriefingMeta = {
  operationalChanges: OperationalChange[];
  validation: BriefingValidationSummary;
  versionMeta: BriefingVersionMeta;
  briefingStatus: BriefingUiStatus;
};

function validationResultToSummary(validation: ValidationResult): BriefingValidationSummary {
  return {
    severity: validation.severity,
    requiresHumanReview: validation.requiresHumanReview,
    errorCount: validation.errors.length,
    warningCount: validation.warnings.length,
  };
}

export function buildBriefingMeta(input: {
  normalized: NormalizedBeoRecord;
  previousNormalized: NormalizedBeoRecord | null;
  eventStatus: string;
  alerts: AlertRecord[];
  currentVersionNumber: number | null;
  previousVersionNumber: number | null;
  /** When set (e.g. from a persisted promotion snapshot), skip live diff detection. */
  operationalChangesOverride?: OperationalChange[] | null;
  /** When set, use instead of re-running validation on `normalized`. */
  validationFromPersisted?: ValidationResult | null;
}): BriefingMeta {
  const operationalChanges =
    input.operationalChangesOverride ??
    (input.previousNormalized
      ? detectOperationalChanges(input.previousNormalized, input.normalized)
      : []);

  const validation = input.validationFromPersisted
    ? validationResultToSummary(input.validationFromPersisted)
    : summarizeValidation(input.normalized);
  const briefingStatus = mergeStatusWithValidation(
    mapAlertsToBriefingStatus(input.eventStatus, input.alerts),
    validation,
  );

  return {
    operationalChanges,
    validation,
    versionMeta: {
      currentVersion: input.currentVersionNumber,
      previousVersion: input.previousVersionNumber,
    },
    briefingStatus,
  };
}
