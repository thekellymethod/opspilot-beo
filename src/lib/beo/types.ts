import type { EventRecord, EventVersionRecord } from "@/lib/types";

export type ConfidenceValue = number | null;

export type ExtractedField<T> = {
  value: T | null;
  confidence: ConfidenceValue;
  sourceExcerpt: string | null;
};

export type ServiceStyle =
  | "plated"
  | "buffet"
  | "stations"
  | "reception"
  | "boxed_meal"
  | "beverage_only"
  | "unknown";

export type RoomSetupStyle =
  | "rounds"
  | "classroom"
  | "theater"
  | "boardroom"
  | "u_shape"
  | "reception"
  | "unknown";

export type DietaryFlagType =
  | "vegan"
  | "vegetarian"
  | "gluten_free"
  | "dairy_free"
  | "nut_allergy"
  | "shellfish_allergy"
  | "kosher"
  | "halal"
  | "other";

export type Severity = "low" | "medium" | "high" | "critical";
export type ReviewSeverity = "ok" | "warning" | "review_required";

export type ExtractedWarning = {
  field?: string;
  message: string;
};

export type ExtractedTimeline = {
  loadInStart: ExtractedField<string>;
  setupStart: ExtractedField<string>;
  staffCallTime: ExtractedField<string>;
  guestArrivalTime: ExtractedField<string>;
  serviceStartTime: ExtractedField<string>;
  serviceEndTime: ExtractedField<string>;
  breakdownStart: ExtractedField<string>;
  eventEndTime: ExtractedField<string>;
};

export type ExtractedVenue = {
  propertyName: ExtractedField<string>;
  roomName: ExtractedField<string>;
  roomSetupStyle: ExtractedField<RoomSetupStyle | string>;
  expectedGuests: ExtractedField<number>;
  guaranteedGuests: ExtractedField<number>;
};

export type ExtractedMenuItem = {
  course: ExtractedField<string>;
  item: ExtractedField<string>;
  count: ExtractedField<number>;
};

export type ExtractedDietaryNote = {
  note: ExtractedField<string>;
};

export type ExtractedFoodBeverage = {
  serviceStyle: ExtractedField<ServiceStyle | string>;
  menu: ExtractedMenuItem[];
  dietaryNotes: ExtractedDietaryNote[];
};

export type ExtractedEquipmentItem = {
  name: ExtractedField<string>;
  quantity: ExtractedField<number>;
};

export type ExtractedBillingNotes = {
  minimumRevenue: ExtractedField<number>;
  depositReceived: ExtractedField<boolean>;
  finalGuaranteeDue: ExtractedField<string>;
};

export type ExtractedDepartmentRemark = {
  department: ExtractedField<string>;
  note: ExtractedField<string>;
};

export type ExtractedContact = {
  role: ExtractedField<string>;
  name: ExtractedField<string>;
};

export type ExtractedSignoffRequirement = {
  role: ExtractedField<string>;
  required: ExtractedField<boolean>;
  dueAt: ExtractedField<string>;
};

export type RawBeoExtraction = {
  eventName: ExtractedField<string>;
  clientName: ExtractedField<string>;
  eventType: ExtractedField<string>;
  eventDate: ExtractedField<string>;
  timezone: ExtractedField<string>;
  timeline: ExtractedTimeline;
  venue: ExtractedVenue;
  foodBeverage: ExtractedFoodBeverage;
  equipment: ExtractedEquipmentItem[];
  specialRequests: ExtractedField<string[]>;
  staffingNotes: ExtractedField<string[]>;
  billingNotes: ExtractedBillingNotes;
  billingInstructions: ExtractedField<string[]>;
  departmentRemarks: ExtractedDepartmentRemark[];
  contacts: ExtractedContact[];
  signoffRequirements: ExtractedSignoffRequirement[];
  opsRequirements: ExtractedField<string[]>;
  criticalMissingFields: string[];
  extractionWarnings: ExtractedWarning[];
};

export type DietaryFlag = {
  type: DietaryFlagType;
  count: number;
  priority: Severity;
  originalText: string;
};

export type NormalizedBeoRecord = {
  eventName: string | null;
  clientName: string | null;
  eventType: string | null;
  eventDate: string | null;
  timezone: string;
  propertyName: string | null;
  roomName: string | null;
  roomSetupStyle: RoomSetupStyle;
  serviceStyle: ServiceStyle;
  expectedGuests: number | null;
  guaranteedGuests: number | null;
  loadInStart: string | null;
  setupStart: string | null;
  staffCallTime: string | null;
  guestArrivalTime: string | null;
  serviceStartTime: string | null;
  serviceEndTime: string | null;
  breakdownStart: string | null;
  eventEndTime: string | null;
  menu: Array<{
    course: string | null;
    item: string | null;
    count: number | null;
  }>;
  dietaryFlags: DietaryFlag[];
  rawDietaryNotes: string[];
  equipment: Array<{
    name: string;
    quantity: number | null;
  }>;
  specialRequests: string[];
  staffingNotes: string[];
  billingNotes: {
    minimumRevenue: number | null;
    depositReceived: boolean | null;
    finalGuaranteeDue: string | null;
  };
  billingInstructions: string[];
  departmentRemarks: Array<{
    department: string;
    note: string;
  }>;
  contacts: Array<{
    role: string;
    name: string;
  }>;
  signoffRequirements: Array<{
    role: string;
    required: boolean;
    dueAt: string | null;
  }>;
  opsRequirements: string[];
  criticalMissingFields: string[];
  extractionWarnings: ExtractedWarning[];
  fieldEvidence: Record<
    string,
    {
      confidence: number | null;
      sourceExcerpt: string | null;
    }
  >;
};

export type ValidationIssue = {
  field: string;
  type:
    | "missing_required"
    | "invalid_type"
    | "invalid_value"
    | "logical_conflict"
    | "source_conflict";
  message: string;
};

export type ValidationResult = {
  isValid: boolean;
  severity: ReviewSeverity;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  requiresHumanReview: boolean;
};

export type ReviewRoutingResult = {
  autoApprove: boolean;
  reason:
    | "approved"
    | "low_confidence"
    | "missing_critical_fields"
    | "validation_errors"
    | "warnings_present";
  metrics: {
    averageCriticalConfidence: number | null;
    criticalFieldCount: number;
    criticalFieldsPresent: number;
  };
};

/** --- persistence / orchestration (connects to DB + PDF elsewhere) --- */

export type BeoSourceType = "pdf" | "email_text";
export type RawTextStatus = "pending" | "complete" | "failed";
export type ParseStatus = "pending" | "extracting" | "complete" | "failed" | "review_required" | "approved";

export interface BeoSourceRecord {
  id: string;
  source_type: BeoSourceType;
  filename: string | null;
  property_id: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
  sender: string | null;
  linked_event_id: string | null;
  revision_sequence: number | null;
  raw_text: string;
  cleaned_text: string | null;
  raw_text_status: RawTextStatus;
  parse_status: ParseStatus;
  storage_url: string | null;
  prompt_version: string | null;
  latest_ai_extraction: RawBeoExtraction | null;
  latest_normalized: NormalizedBeoRecord | null;
  latest_validation: ValidationResult | null;
  requires_human_review: boolean;
}

export type ProcessBeoSourceResult =
  | {
      status: "approved";
      source: BeoSourceRecord;
      event: EventRecord;
      version: EventVersionRecord;
    }
  | {
      status: "review_required";
      source: BeoSourceRecord;
      validation: ValidationResult;
      normalized: NormalizedBeoRecord;
      event: EventRecord;
      version: EventVersionRecord;
    }
  | {
      status: "failed";
      source: BeoSourceRecord;
      error: string;
    };
