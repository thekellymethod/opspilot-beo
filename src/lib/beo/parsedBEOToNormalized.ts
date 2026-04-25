import type { NormalizedBeoRecord, ServiceStyle } from "@/lib/beo/types";
import type { ParsedBEO } from "@/lib/types";

function mapParsedServiceStyle(s: ParsedBEO["service_style"]): ServiceStyle {
  if (s === "plated") return "plated";
  if (s === "buffet") return "buffet";
  if (s === "reception") return "reception";
  return "unknown";
}

/** Best-effort bridge when only legacy `ParsedBEO` exists on an event version. */
export function parsedBEOToNormalized(parsed: ParsedBEO, timezone = "America/Chicago"): NormalizedBeoRecord {
  const guestCount = parsed.guest_count > 0 ? parsed.guest_count : null;

  return {
    eventName: parsed.event_name,
    clientName: parsed.client_name,
    eventType: parsed.event_type,
    eventDate: parsed.event_date,
    timezone,
    propertyName: null,
    roomName: parsed.room_name,
    roomSetupStyle: "unknown",
    serviceStyle: mapParsedServiceStyle(parsed.service_style),
    expectedGuests: null,
    guaranteedGuests: guestCount,
    loadInStart: null,
    setupStart: null,
    staffCallTime: null,
    guestArrivalTime: null,
    serviceStartTime: null,
    serviceEndTime: null,
    breakdownStart: null,
    eventEndTime: null,
    menu: parsed.menu.map((m) => ({
      course: m.course,
      item: m.item,
      count: m.count,
    })),
    dietaryFlags: parsed.dietary_notes.map((note) => ({
      type: "other" as const,
      count: 1,
      priority: "low" as const,
      originalText: note,
    })),
    rawDietaryNotes: [...parsed.dietary_notes],
    equipment: parsed.equipment.map((name) => ({ name, quantity: null })),
    specialRequests: [...parsed.special_notes],
    staffingNotes: [],
    billingNotes: {
      minimumRevenue: null,
      depositReceived: null,
      finalGuaranteeDue: null,
    },
    billingInstructions: [],
    departmentRemarks: [],
    contacts: [],
    signoffRequirements: [],
    opsRequirements: [],
    criticalMissingFields: [],
    extractionWarnings: [],
    fieldEvidence: {},
  };
}
