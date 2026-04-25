import { normalizedBeoRecordSchema } from "@/lib/beo/schema";
import type { NormalizedBeoRecord, ValidationIssue, ValidationResult } from "@/lib/beo/types";

function isIsoLikeDateTime(value: string | null): boolean {
  if (!value) return false;
  return !Number.isNaN(Date.parse(value));
}

function pushError(
  errors: ValidationIssue[],
  field: string,
  type: ValidationIssue["type"],
  message: string,
) {
  errors.push({ field, type, message });
}

function pushWarning(
  warnings: ValidationIssue[],
  field: string,
  type: ValidationIssue["type"],
  message: string,
) {
  warnings.push({ field, type, message });
}

function isInformationalExtractionWarning(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("heuristic backfill used for missing fields");
}

export function validateBeoRecord(record: NormalizedBeoRecord): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const parsed = normalizedBeoRecordSchema.safeParse(record);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      pushError(errors, issue.path.join(".") || "root", "invalid_type", issue.message);
    }
  }

  const requiredFields: Array<keyof NormalizedBeoRecord> = ["eventName", "eventDate", "roomName", "serviceStyle"];

  for (const field of requiredFields) {
    const value = record[field];
    if (value === null || value === undefined || value === "" || value === "unknown") {
      pushError(errors, String(field), "missing_required", `${String(field)} is required.`);
    }
  }

  if (record.guaranteedGuests === null && record.expectedGuests === null) {
    pushError(errors, "guaranteedGuests", "missing_required", "At least one guest count field is required.");
  }

  const timeFields: Array<keyof NormalizedBeoRecord> = [
    "loadInStart",
    "setupStart",
    "staffCallTime",
    "guestArrivalTime",
    "serviceStartTime",
    "serviceEndTime",
    "breakdownStart",
    "eventEndTime",
  ];

  for (const field of timeFields) {
    const value = record[field];
    if (typeof value === "string" && value && !isIsoLikeDateTime(value)) {
      pushWarning(warnings, String(field), "invalid_value", `${String(field)} does not appear to be a parseable datetime.`);
    }
  }

  if (
    record.setupStart &&
    record.guestArrivalTime &&
    isIsoLikeDateTime(record.setupStart) &&
    isIsoLikeDateTime(record.guestArrivalTime)
  ) {
    if (new Date(record.setupStart).getTime() > new Date(record.guestArrivalTime).getTime()) {
      pushError(errors, "setupStart", "logical_conflict", "Setup start occurs after guest arrival.");
    }
  }

  if (
    record.serviceStartTime &&
    record.eventEndTime &&
    isIsoLikeDateTime(record.serviceStartTime) &&
    isIsoLikeDateTime(record.eventEndTime)
  ) {
    if (new Date(record.serviceStartTime).getTime() > new Date(record.eventEndTime).getTime()) {
      pushError(errors, "serviceStartTime", "logical_conflict", "Service start occurs after event end.");
    }
  }

  if (
    record.serviceEndTime &&
    record.serviceStartTime &&
    isIsoLikeDateTime(record.serviceStartTime) &&
    isIsoLikeDateTime(record.serviceEndTime)
  ) {
    if (new Date(record.serviceEndTime).getTime() < new Date(record.serviceStartTime).getTime()) {
      pushError(errors, "serviceEndTime", "logical_conflict", "Service end occurs before service start.");
    }
  }

  if (record.guaranteedGuests !== null && record.guaranteedGuests <= 0) {
    pushError(errors, "guaranteedGuests", "invalid_value", "Guaranteed guests must be greater than zero.");
  }

  if (record.expectedGuests !== null && record.expectedGuests <= 0) {
    pushError(errors, "expectedGuests", "invalid_value", "Expected guests must be greater than zero.");
  }

  if (record.serviceStyle === "plated" && record.menu.length === 0) {
    pushWarning(warnings, "menu", "missing_required", "Plated service is present but no menu items were extracted.");
  }
  if (record.billingInstructions.length === 0) {
    pushWarning(warnings, "billingInstructions", "missing_required", "Billing instructions were not extracted.");
  }
  if (record.departmentRemarks.length === 0) {
    pushWarning(warnings, "departmentRemarks", "missing_required", "Department remarks were not extracted.");
  }
  if (record.signoffRequirements.length === 0) {
    pushWarning(warnings, "signoffRequirements", "missing_required", "No sign-off requirements were extracted.");
  }

  if (record.rawDietaryNotes.length > 0 && record.serviceStyle === "beverage_only") {
    pushWarning(
      warnings,
      "rawDietaryNotes",
      "logical_conflict",
      "Dietary notes exist on an event marked beverage_only. Review needed.",
    );
  }

  for (const warning of record.extractionWarnings) {
    // Keep this note for audit/debugging, but do not block approval by itself.
    if (isInformationalExtractionWarning(warning.message)) {
      continue;
    }
    pushWarning(warnings, warning.field ?? "extractionWarnings", "source_conflict", warning.message);
  }

  const isValid = errors.length === 0;
  const requiresHumanReview = errors.length > 0 || warnings.length > 0;
  const severity: ValidationResult["severity"] = errors.length
    ? "review_required"
    : warnings.length
      ? "warning"
      : "ok";

  return {
    isValid,
    severity,
    errors,
    warnings,
    requiresHumanReview,
  };
}
