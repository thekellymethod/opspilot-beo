import type { NormalizedBeoRecord, ReviewRoutingResult, ValidationResult } from "@/lib/beo/types";

const CRITICAL_FIELDS = [
  "eventName",
  "eventDate",
  "roomName",
  "guaranteedGuests",
  "guestArrivalTime",
  "serviceStartTime",
  "serviceStyle",
] as const;

function criticalFieldSatisfied(field: (typeof CRITICAL_FIELDS)[number], record: NormalizedBeoRecord): boolean {
  if (field === "guaranteedGuests") {
    return record.guaranteedGuests != null || record.expectedGuests != null;
  }
  const value = (record as Record<string, unknown>)[field];
  return value !== null && value !== undefined && value !== "" && value !== "unknown";
}

function isBlockingWarning(warning: ValidationResult["warnings"][number]): boolean {
  if (
    warning.type === "source_conflict" &&
    warning.field === "extractionWarnings" &&
    warning.message.toLowerCase().includes("heuristic backfill used for missing fields")
  ) {
    return false;
  }
  return true;
}

export function routeBeoForReview(
  record: NormalizedBeoRecord,
  validation: ValidationResult,
  minAverageCriticalConfidence = 0.9,
): ReviewRoutingResult {
  const confidences = CRITICAL_FIELDS.map((field) => {
    if (field === "guaranteedGuests") {
      return (
        record.fieldEvidence.guaranteedGuests?.confidence ??
        record.fieldEvidence.expectedGuests?.confidence ??
        null
      );
    }
    return record.fieldEvidence[field]?.confidence ?? null;
  }).filter((v): v is number => v !== null);

  const averageCriticalConfidence =
    confidences.length > 0 ? confidences.reduce((sum, v) => sum + v, 0) / confidences.length : null;

  const criticalFieldsPresent = CRITICAL_FIELDS.filter((field) => criticalFieldSatisfied(field, record)).length;

  if (!validation.isValid) {
    return {
      autoApprove: false,
      reason: "validation_errors",
      metrics: {
        averageCriticalConfidence,
        criticalFieldCount: CRITICAL_FIELDS.length,
        criticalFieldsPresent,
      },
    };
  }

  if (criticalFieldsPresent < CRITICAL_FIELDS.length) {
    return {
      autoApprove: false,
      reason: "missing_critical_fields",
      metrics: {
        averageCriticalConfidence,
        criticalFieldCount: CRITICAL_FIELDS.length,
        criticalFieldsPresent,
      },
    };
  }

  if (averageCriticalConfidence === null || averageCriticalConfidence < minAverageCriticalConfidence) {
    return {
      autoApprove: false,
      reason: "low_confidence",
      metrics: {
        averageCriticalConfidence,
        criticalFieldCount: CRITICAL_FIELDS.length,
        criticalFieldsPresent,
      },
    };
  }

  const blockingWarnings = validation.warnings.filter(isBlockingWarning);
  if (blockingWarnings.length > 0) {
    return {
      autoApprove: false,
      reason: "warnings_present",
      metrics: {
        averageCriticalConfidence,
        criticalFieldCount: CRITICAL_FIELDS.length,
        criticalFieldsPresent,
      },
    };
  }

  return {
    autoApprove: true,
    reason: "approved",
    metrics: {
      averageCriticalConfidence,
      criticalFieldCount: CRITICAL_FIELDS.length,
      criticalFieldsPresent,
    },
  };
}
