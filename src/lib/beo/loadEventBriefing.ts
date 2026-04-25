import { generateBriefing, type BriefingLevel } from "@/lib/beo/briefingGenerator";
import { buildBriefingMeta, type BriefingMeta, type BriefingUiStatus } from "@/lib/beo/briefingMeta";
import { parsedBEOToNormalized } from "@/lib/beo/parsedBEOToNormalized";
import { resolveBriefingBundle } from "@/lib/beo/resolveBriefingBundle";
import type { NormalizedBeoRecord } from "@/lib/beo/types";
import type { AlertRecord } from "@/lib/types";
import { getEvent } from "@/lib/store";

export type EventStatus = BriefingUiStatus;

export type EventBriefingPageData = {
  briefing: ReturnType<typeof generateBriefing>;
  eventDate: string | null;
  location: string | null;
  status: EventStatus;
  operationalChanges: BriefingMeta["operationalChanges"];
  validation: BriefingMeta["validation"];
  versionMeta: BriefingMeta["versionMeta"];
};

type StoredEventRecord = {
  id: string;
  event_name: string | null;
  event_date: string | null;
  property_name: string | null;
  eventStatus: string;
  alerts: AlertRecord[];
  current_normalized_record: NormalizedBeoRecord;
  previous_normalized_record: NormalizedBeoRecord | null;
  currentVersionNumber: number | null;
  previousVersionNumber: number | null;
};

const BRIEFING_LEVELS: BriefingLevel[] = ["executive", "management", "department"];

function formatEventDate(date: string | null, timezone = "America/Chicago"): string | null {
  if (!date) return null;

  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;

  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function buildLocation(stored: StoredEventRecord): string | null {
  const parts = [stored.property_name, stored.current_normalized_record.roomName].filter(Boolean) as string[];
  return parts.length ? parts.join(" · ") : null;
}

/**
 * Rich mock record for local development when no DB row exists.
 * Disabled in production unless explicitly allowed.
 */
function getMockStoredEventRecord(eventId: string): StoredEventRecord {
  const current: NormalizedBeoRecord = {
    eventName: "ABC Pharma Regional Dinner",
    clientName: "ABC Pharma",
    eventType: "corporate_dinner",
    eventDate: "2026-05-12",
    timezone: "America/Chicago",
    propertyName: "Marriott St. Louis West",
    roomName: "Grand Ballroom B",
    roomSetupStyle: "classroom",
    serviceStyle: "buffet",
    expectedGuests: 140,
    guaranteedGuests: 140,
    loadInStart: null,
    setupStart: "2026-05-12T15:00:00-05:00",
    staffCallTime: "2026-05-12T16:30:00-05:00",
    guestArrivalTime: "2026-05-12T17:45:00-05:00",
    serviceStartTime: "2026-05-12T18:15:00-05:00",
    serviceEndTime: "2026-05-12T20:00:00-05:00",
    breakdownStart: "2026-05-12T20:30:00-05:00",
    eventEndTime: "2026-05-12T21:00:00-05:00",
    menu: [
      { course: "entrée", item: "Chicken entrée", count: 100 },
      { course: "entrée", item: "Vegetarian pasta", count: 35 },
      { course: "dessert", item: "Cheesecake", count: 140 },
    ],
    dietaryFlags: [
      { type: "vegan", count: 1, priority: "high", originalText: "1 Vegan VIP" },
      { type: "nut_allergy", count: 2, priority: "critical", originalText: "2 Nut Allergy" },
      { type: "gluten_free", count: 3, priority: "high", originalText: "3 GF" },
    ],
    rawDietaryNotes: ["1 Vegan VIP", "2 Nut Allergy", "3 GF"],
    equipment: [
      { name: "Wireless Mic", quantity: 2 },
      { name: "Podium", quantity: 1 },
      { name: "Projector", quantity: 1 },
    ],
    specialRequests: ["VIP near stage"],
    staffingNotes: ["1 additional buffet attendant requested"],
    billingNotes: {
      minimumRevenue: 5000,
      depositReceived: true,
      finalGuaranteeDue: "2026-05-09T17:00:00-05:00",
    },
    billingInstructions: ["Minimum Guarantee (MG): 140", "Mode of payment: Direct bill"],
    departmentRemarks: [
      { department: "engineering", note: "Confirm ballroom HVAC one hour prior to guest arrival." },
      { department: "housekeeping", note: "Refresh restrooms every 45 minutes during service window." },
    ],
    contacts: [
      { role: "event_manager", name: "Taylor Brooks" },
      { role: "onsite_contact", name: "Jordan Lee" },
    ],
    signoffRequirements: [
      { role: "management", required: true, dueAt: "2026-05-11T17:00:00-05:00" },
      { role: "banquets", required: true, dueAt: "2026-05-11T17:00:00-05:00" },
    ],
    opsRequirements: ["Stage map approval by 5 PM prior day", "Dedicated registration desk with power drop"],
    criticalMissingFields: [],
    extractionWarnings: [],
    fieldEvidence: {
      eventName: { confidence: 0.98, sourceExcerpt: "ABC Pharma Regional Dinner" },
      clientName: { confidence: 0.92, sourceExcerpt: "ABC Pharma" },
      eventType: { confidence: 0.78, sourceExcerpt: "Corporate Dinner" },
      eventDate: { confidence: 0.99, sourceExcerpt: "5/12/26" },
      timezone: { confidence: 0.9, sourceExcerpt: "CST" },
      propertyName: { confidence: 0.95, sourceExcerpt: "Marriott St. Louis West" },
      roomName: { confidence: 0.96, sourceExcerpt: "Grand Ballroom B" },
      roomSetupStyle: { confidence: 0.94, sourceExcerpt: "Classroom" },
      expectedGuests: { confidence: 0.95, sourceExcerpt: "140" },
      guaranteedGuests: { confidence: 0.97, sourceExcerpt: "Final Guarantee 140" },
      loadInStart: { confidence: null, sourceExcerpt: null },
      setupStart: { confidence: 0.91, sourceExcerpt: "Setup 3:00 PM" },
      staffCallTime: { confidence: 0.9, sourceExcerpt: "Staff Call 4:30 PM" },
      guestArrivalTime: { confidence: 0.95, sourceExcerpt: "Guests 5:45 PM" },
      serviceStartTime: { confidence: 0.94, sourceExcerpt: "Dinner 6:15 PM" },
      serviceEndTime: { confidence: 0.82, sourceExcerpt: "Service ends 8:00 PM" },
      breakdownStart: { confidence: 0.8, sourceExcerpt: "Breakdown 8:30 PM" },
      eventEndTime: { confidence: 0.91, sourceExcerpt: "Event end 9:00 PM" },
      serviceStyle: { confidence: 0.98, sourceExcerpt: "Buffet" },
      specialRequests: { confidence: 0.88, sourceExcerpt: "VIP near stage" },
      staffingNotes: { confidence: 0.85, sourceExcerpt: "1 additional buffet attendant requested" },
      minimumRevenue: { confidence: 0.9, sourceExcerpt: "$5000 minimum" },
      depositReceived: { confidence: 0.9, sourceExcerpt: "Deposit received" },
      finalGuaranteeDue: { confidence: 0.9, sourceExcerpt: "Guarantee due 5/9/26" },
    },
  };

  const previous: NormalizedBeoRecord = {
    ...current,
    roomName: "Grand Ballroom A",
    roomSetupStyle: "rounds",
    serviceStyle: "plated",
    expectedGuests: 115,
    guaranteedGuests: 115,
    guestArrivalTime: "2026-05-12T18:00:00-05:00",
    serviceStartTime: "2026-05-12T18:30:00-05:00",
    rawDietaryNotes: ["1 Vegan VIP", "2 Nut Allergy"],
    dietaryFlags: [
      { type: "vegan", count: 1, priority: "high", originalText: "1 Vegan VIP" },
      { type: "nut_allergy", count: 2, priority: "critical", originalText: "2 Nut Allergy" },
    ],
    equipment: [
      { name: "Wireless Mic", quantity: 2 },
      { name: "Podium", quantity: 1 },
    ],
    menu: [
      { course: "entrée", item: "Chicken entrée", count: 80 },
      { course: "entrée", item: "Vegetarian pasta", count: 35 },
    ],
  };

  return {
    id: eventId,
    event_name: current.eventName,
    event_date: current.eventDate,
    property_name: current.propertyName,
    eventStatus: "active",
    alerts: [],
    current_normalized_record: current,
    previous_normalized_record: previous,
    currentVersionNumber: 2,
    previousVersionNumber: 1,
  };
}

async function getStoredEventRecordById(eventId: string): Promise<StoredEventRecord | null> {
  if (!eventId) return null;

  const allowDevMock =
    process.env.NODE_ENV === "development" && process.env.BEO_DISABLE_MOCK_BRIEFING !== "1";
  const allowProdMock = process.env.BEO_ALLOW_MOCK_BRIEFING === "1";
  if (allowDevMock || allowProdMock) {
    return getMockStoredEventRecord(eventId);
  }

  return null;
}

export type LoadEventBriefingOptions = {
  level?: BriefingLevel;
};

export async function loadEventBriefing(
  eventId: string,
  options?: LoadEventBriefingOptions,
): Promise<EventBriefingPageData | null> {
  const levelParam = options?.level;
  const level: BriefingLevel = BRIEFING_LEVELS.includes(levelParam as BriefingLevel)
    ? (levelParam as BriefingLevel)
    : "management";

  const bundle = await resolveBriefingBundle(eventId, level);
  if (bundle) {
    return {
      briefing: bundle.briefingDoc,
      eventDate: formatEventDate(bundle.event.event_date, bundle.normalized.timezone),
      location: bundle.briefingLocation,
      status: bundle.meta.briefingStatus,
      operationalChanges: bundle.meta.operationalChanges,
      validation: bundle.meta.validation,
      versionMeta: bundle.meta.versionMeta,
    };
  }

  if (await getEvent(eventId)) {
    return null;
  }

  const stored = await getStoredEventRecordById(eventId);
  if (!stored) return null;

  const meta = buildBriefingMeta({
    normalized: stored.current_normalized_record,
    previousNormalized: stored.previous_normalized_record,
    eventStatus: stored.eventStatus,
    alerts: stored.alerts,
    currentVersionNumber: stored.currentVersionNumber,
    previousVersionNumber: stored.previousVersionNumber,
  });

  const briefing = generateBriefing(stored.current_normalized_record, meta.operationalChanges, {
    eventId: stored.id,
    level,
  });

  return {
    briefing,
    eventDate: formatEventDate(stored.event_date, stored.current_normalized_record.timezone),
    location: buildLocation(stored),
    status: meta.briefingStatus,
    operationalChanges: meta.operationalChanges,
    validation: meta.validation,
    versionMeta: meta.versionMeta,
  };
}
