import type {
  DietaryFlag,
  DietaryFlagType,
  ExtractedField,
  RawBeoExtraction,
  RoomSetupStyle,
  ServiceStyle,
  Severity,
  NormalizedBeoRecord,
} from "@/lib/beo/types";

const SERVICE_STYLE_MAP: Record<string, ServiceStyle> = {
  plated: "plated",
  "plated entree": "plated",
  "plated dinner": "plated",
  buffet: "buffet",
  "buffet service": "buffet",
  stations: "stations",
  station: "stations",
  reception: "reception",
  "boxed meal": "boxed_meal",
  "boxed meals": "boxed_meal",
  beverage: "beverage_only",
  "beverage only": "beverage_only",
  unknown: "unknown",
};

const ROOM_SETUP_MAP: Record<string, RoomSetupStyle> = {
  rounds: "rounds",
  round: "rounds",
  classroom: "classroom",
  schoolroom: "classroom",
  theater: "theater",
  theatre: "theater",
  boardroom: "boardroom",
  "u shape": "u_shape",
  ushape: "u_shape",
  reception: "reception",
  unknown: "unknown",
};

function normalizeString(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length ? cleaned : null;
}

function normalizeEnum<T extends string>(raw: string | null | undefined, map: Record<string, T>, fallback: T): T {
  const normalized = normalizeString(raw)?.toLowerCase();
  if (!normalized) return fallback;
  return map[normalized] ?? fallback;
}

function normalizeInteger(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  return Math.round(value);
}

function toParseableDateTime(value: string | null, eventDate: string | null): string | null {
  const cleaned = normalizeString(value);
  if (!cleaned) return null;
  if (!Number.isNaN(Date.parse(cleaned))) return cleaned;
  if (!eventDate) return cleaned;

  // Supports "07:00", "7:00", "7:00 PM", "07:00AM".
  const m = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return cleaned;
  let hour = Number(m[1]);
  const minute = Number(m[2]);
  const meridiem = m[3]?.toUpperCase();
  if (Number.isNaN(hour) || Number.isNaN(minute) || minute > 59) return cleaned;
  if (meridiem === "PM" && hour < 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  const hh = String(Math.max(0, Math.min(23, hour))).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return `${eventDate}T${hh}:${mm}:00`;
}

function pickField<T>(field: ExtractedField<T>) {
  return {
    value: field.value,
    confidence: field.confidence ?? null,
    sourceExcerpt: field.sourceExcerpt ?? null,
  };
}

function detectDietaryType(note: string): DietaryFlagType {
  const lower = note.toLowerCase();
  if (/\bspecial meal\b|\bvip meal\b/i.test(lower) && !/(vegan|vegetarian|gluten|nut|dairy|shellfish|kosher|halal)/i.test(lower)) {
    return "other";
  }
  if (lower.includes("vegan")) return "vegan";
  if (lower.includes("vegetarian")) return "vegetarian";
  if (lower.includes("gluten")) return "gluten_free";
  if (lower.includes("dairy") || lower.includes("lactose")) return "dairy_free";
  if (lower.includes("nut") || lower.includes("peanut")) return "nut_allergy";
  if (lower.includes("shellfish")) return "shellfish_allergy";
  if (lower.includes("kosher")) return "kosher";
  if (lower.includes("halal")) return "halal";
  return "other";
}

function detectDietaryPriority(type: DietaryFlagType): Severity {
  switch (type) {
    case "nut_allergy":
    case "shellfish_allergy":
      return "critical";
    case "gluten_free":
    case "dairy_free":
    case "vegan":
    case "vegetarian":
      return "high";
    case "kosher":
    case "halal":
      return "medium";
    default:
      return "low";
  }
}

function extractCountFromNote(note: string): number {
  const match = note.match(/\b(\d+)\b/);
  return match ? Number(match[1]) : 1;
}

function parseDietaryFlags(notes: string[]): DietaryFlag[] {
  return notes
    .map((note) => normalizeString(note))
    .filter((note): note is string => Boolean(note))
    .map((note) => {
      const type = detectDietaryType(note);
      return {
        type,
        count: extractCountFromNote(note),
        priority: detectDietaryPriority(type),
        originalText: note,
      };
    });
}

function buildFieldEvidence(extraction: RawBeoExtraction): NormalizedBeoRecord["fieldEvidence"] {
  return {
    eventName: pickField(extraction.eventName),
    clientName: pickField(extraction.clientName),
    eventType: pickField(extraction.eventType),
    eventDate: pickField(extraction.eventDate),
    timezone: pickField(extraction.timezone),
    propertyName: pickField(extraction.venue.propertyName),
    roomName: pickField(extraction.venue.roomName),
    roomSetupStyle: pickField(extraction.venue.roomSetupStyle),
    expectedGuests: pickField(extraction.venue.expectedGuests),
    guaranteedGuests: pickField(extraction.venue.guaranteedGuests),
    loadInStart: pickField(extraction.timeline.loadInStart),
    setupStart: pickField(extraction.timeline.setupStart),
    staffCallTime: pickField(extraction.timeline.staffCallTime),
    guestArrivalTime: pickField(extraction.timeline.guestArrivalTime),
    serviceStartTime: pickField(extraction.timeline.serviceStartTime),
    serviceEndTime: pickField(extraction.timeline.serviceEndTime),
    breakdownStart: pickField(extraction.timeline.breakdownStart),
    eventEndTime: pickField(extraction.timeline.eventEndTime),
    serviceStyle: pickField(extraction.foodBeverage.serviceStyle),
    specialRequests: pickField(extraction.specialRequests),
    staffingNotes: pickField(extraction.staffingNotes),
    minimumRevenue: pickField(extraction.billingNotes.minimumRevenue),
    depositReceived: pickField(extraction.billingNotes.depositReceived),
    finalGuaranteeDue: pickField(extraction.billingNotes.finalGuaranteeDue),
  };
}

export function normalizeBeoFields(extraction: RawBeoExtraction, options?: { defaultTimezone?: string }): NormalizedBeoRecord {
  const defaultTimezone = options?.defaultTimezone ?? "America/Chicago";
  const eventDate = normalizeString(extraction.eventDate.value);

  const rawDietaryNotes = extraction.foodBeverage.dietaryNotes
    .map((entry) => normalizeString(entry.note.value))
    .filter((value): value is string => Boolean(value));

  return {
    eventName: normalizeString(extraction.eventName.value),
    clientName: normalizeString(extraction.clientName.value),
    eventType: normalizeString(extraction.eventType.value),
    eventDate,
    timezone: normalizeString(extraction.timezone.value) ?? defaultTimezone,
    propertyName: normalizeString(extraction.venue.propertyName.value),
    roomName: normalizeString(extraction.venue.roomName.value),
    roomSetupStyle: normalizeEnum(extraction.venue.roomSetupStyle.value as string | null | undefined, ROOM_SETUP_MAP, "unknown"),
    serviceStyle: normalizeEnum(extraction.foodBeverage.serviceStyle.value as string | null | undefined, SERVICE_STYLE_MAP, "unknown"),
    expectedGuests: (() => {
      const n = normalizeInteger(extraction.venue.expectedGuests.value);
      return n !== null && n > 0 ? n : null;
    })(),
    guaranteedGuests: (() => {
      const n = normalizeInteger(extraction.venue.guaranteedGuests.value);
      return n !== null && n > 0 ? n : null;
    })(),
    loadInStart: toParseableDateTime(extraction.timeline.loadInStart.value, eventDate),
    setupStart: toParseableDateTime(extraction.timeline.setupStart.value, eventDate),
    staffCallTime: toParseableDateTime(extraction.timeline.staffCallTime.value, eventDate),
    guestArrivalTime: toParseableDateTime(extraction.timeline.guestArrivalTime.value, eventDate),
    serviceStartTime: toParseableDateTime(extraction.timeline.serviceStartTime.value, eventDate),
    serviceEndTime: toParseableDateTime(extraction.timeline.serviceEndTime.value, eventDate),
    breakdownStart: toParseableDateTime(extraction.timeline.breakdownStart.value, eventDate),
    eventEndTime: toParseableDateTime(extraction.timeline.eventEndTime.value, eventDate),

    menu: extraction.foodBeverage.menu.map((item) => ({
      course: normalizeString(item.course.value),
      item: normalizeString(item.item.value),
      count: normalizeInteger(item.count.value),
    })),

    dietaryFlags: parseDietaryFlags(rawDietaryNotes),
    rawDietaryNotes,
    equipment: extraction.equipment
      .map((entry) => ({
        name: normalizeString(entry.name.value),
        quantity: normalizeInteger(entry.quantity.value),
      }))
      .filter((entry): entry is { name: string; quantity: number | null } => Boolean(entry.name)),

    specialRequests: (extraction.specialRequests.value ?? [])
      .map((item) => normalizeString(item))
      .filter((item): item is string => Boolean(item)),

    staffingNotes: (extraction.staffingNotes.value ?? [])
      .map((item) => normalizeString(item))
      .filter((item): item is string => Boolean(item)),

    billingNotes: {
      minimumRevenue: extraction.billingNotes.minimumRevenue.value ?? null,
      depositReceived: extraction.billingNotes.depositReceived.value ?? null,
      finalGuaranteeDue: normalizeString(extraction.billingNotes.finalGuaranteeDue.value),
    },
    billingInstructions: (extraction.billingInstructions.value ?? [])
      .map((item) => normalizeString(item))
      .filter((item): item is string => Boolean(item)),
    departmentRemarks: extraction.departmentRemarks
      .map((entry) => ({
        department: normalizeString(entry.department.value),
        note: normalizeString(entry.note.value),
      }))
      .filter((entry): entry is { department: string; note: string } => Boolean(entry.department && entry.note)),
    contacts: extraction.contacts
      .map((entry) => ({
        role: normalizeString(entry.role.value),
        name: normalizeString(entry.name.value),
      }))
      .filter((entry): entry is { role: string; name: string } => Boolean(entry.role && entry.name)),
    signoffRequirements: extraction.signoffRequirements
      .map((entry) => ({
        role: normalizeString(entry.role.value),
        required: entry.required.value ?? true,
        dueAt: normalizeString(entry.dueAt.value),
      }))
      .filter((entry): entry is { role: string; required: boolean; dueAt: string | null } => Boolean(entry.role)),
    opsRequirements: (extraction.opsRequirements.value ?? [])
      .map((item) => normalizeString(item))
      .filter((item): item is string => Boolean(item)),

    criticalMissingFields: extraction.criticalMissingFields ?? [],
    extractionWarnings: extraction.extractionWarnings ?? [],
    fieldEvidence: buildFieldEvidence(extraction),
  };
}
