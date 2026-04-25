import type { OperationalChange } from "@/lib/beo/changeDetector";
import type { NormalizedBeoRecord } from "@/lib/beo/types";

export type BriefingLevel = "executive" | "management" | "department";

export type BriefingDepartment =
  | "management"
  | "kitchen"
  | "banquets"
  | "bar"
  | "setup"
  | "av";

export type EventBriefing = {
  eventId?: string;
  headline: string;
  summary: string;
  keyFacts: string[];
  timeline: string[];
  risks: string[];
  changes: string[];
  departmentNotes: Record<BriefingDepartment, string[]>;
};

export function emptyDepartmentNotes(): Record<BriefingDepartment, string[]> {
  return {
    management: [],
    kitchen: [],
    banquets: [],
    bar: [],
    setup: [],
    av: [],
  };
}

function formatTime(value: string | null, timeZone?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  });
}

function formatGuestCount(record: NormalizedBeoRecord): string {
  const count = record.guaranteedGuests ?? record.expectedGuests;
  return count ? `${count} guests` : "guest count unknown";
}

function buildHeadline(record: NormalizedBeoRecord): string {
  const name = record.eventName ?? "Unnamed Event";
  const guests = formatGuestCount(record);
  const service = record.serviceStyle !== "unknown" ? record.serviceStyle : "service unknown";

  return `${name} — ${guests}, ${service}`;
}

function buildSummary(record: NormalizedBeoRecord): string {
  const parts: string[] = [];
  const tz = record.timezone;

  if (record.roomName) {
    parts.push(`Room: ${record.roomName}`);
  }

  if (record.serviceStyle !== "unknown") {
    parts.push(`Service: ${record.serviceStyle}`);
  }

  if (record.guestArrivalTime) {
    parts.push(`Arrival: ${formatTime(record.guestArrivalTime, tz)}`);
  }

  if (record.serviceStartTime) {
    parts.push(`Service: ${formatTime(record.serviceStartTime, tz)}`);
  }

  return parts.join(" | ");
}

function buildTimeline(record: NormalizedBeoRecord): string[] {
  const timeline: string[] = [];
  const tz = record.timezone;

  const map: Array<[string, string | null]> = [
    ["Load-in", record.loadInStart],
    ["Setup", record.setupStart],
    ["Staff Call", record.staffCallTime],
    ["Guest Arrival", record.guestArrivalTime],
    ["Service Start", record.serviceStartTime],
    ["Service End", record.serviceEndTime],
    ["Breakdown", record.breakdownStart],
    ["Event End", record.eventEndTime],
  ];

  for (const [label, value] of map) {
    const formatted = formatTime(value, tz);
    if (formatted) {
      timeline.push(`${label}: ${formatted}`);
    }
  }

  return timeline;
}

function buildKeyFacts(record: NormalizedBeoRecord): string[] {
  const facts: string[] = [];

  const guestCount = record.guaranteedGuests ?? record.expectedGuests;
  if (guestCount) facts.push(`Guest count: ${guestCount}`);

  if (record.roomName) facts.push(`Room: ${record.roomName}`);

  if (record.roomSetupStyle !== "unknown") {
    facts.push(`Setup: ${record.roomSetupStyle.replace(/_/g, " ")}`);
  }

  if (record.serviceStyle !== "unknown") {
    facts.push(`Service: ${record.serviceStyle}`);
  }

  if (record.menu.length > 0) {
    facts.push(`Menu items: ${record.menu.length}`);
  }

  if (record.dietaryFlags.length > 0) {
    const total = record.dietaryFlags.reduce((sum, f) => sum + f.count, 0);
    facts.push(`Dietary meals: ${total}`);
  }

  return facts;
}

function buildRisks(record: NormalizedBeoRecord): string[] {
  const risks: string[] = [];

  const guestCount = record.guaranteedGuests ?? record.expectedGuests;

  if (!guestCount) {
    risks.push("Guest count not confirmed");
  }

  if (!record.serviceStartTime) {
    risks.push("Service start time missing");
  }

  if (record.serviceStyle === "plated" && record.menu.length === 0) {
    risks.push("Plated service with no menu defined");
  }

  if (record.dietaryFlags.some((f) => f.priority === "critical")) {
    risks.push("Critical allergy present");
  }

  if (guestCount && guestCount >= 150) {
    risks.push("High guest count — staffing pressure");
  }

  if (record.specialRequests.length > 0) {
    risks.push("Special requests require confirmation");
  }

  if (record.extractionWarnings.length > 0) {
    risks.push("Source data conflicts detected");
  }

  return risks;
}

function buildChangeNotes(changes: OperationalChange[]): string[] {
  return changes.map((c) => `${c.title}: ${c.message}`);
}

function buildDepartmentNotes(record: NormalizedBeoRecord): Record<BriefingDepartment, string[]> {
  return {
    management: [
      record.eventName ? `Event: ${record.eventName}` : "Unnamed event",
      formatGuestCount(record),
      record.serviceStyle !== "unknown" ? `Service: ${record.serviceStyle}` : "Service unknown",
    ],

    kitchen: [
      record.serviceStyle !== "unknown" ? `Service style: ${record.serviceStyle}` : "Service style unclear",
      ...record.menu.map((m) => m.item ?? "").filter(Boolean),
      ...record.dietaryFlags.map((f) => `${f.count} ${f.type.replace(/_/g, " ")}`),
    ],

    banquets: [
      record.roomName ? `Room: ${record.roomName}` : "Room not assigned",
      record.roomSetupStyle !== "unknown" ? `Setup: ${record.roomSetupStyle}` : "Setup unclear",
      record.specialRequests.length > 0 ? `Special: ${record.specialRequests.join(", ")}` : "No special requests",
    ],

    bar: [
      record.specialRequests.join(" ").toLowerCase().includes("bar")
        ? "Bar service requested"
        : "No explicit bar notes",
    ],

    setup: [
      record.roomName ? `Room: ${record.roomName}` : "Room TBD",
      `${formatGuestCount(record)}`,
      ...record.equipment.map((e) => e.name),
    ],

    av: record.equipment
      .filter((e) => /\bmic\b|\bmicrophone\b|\bprojector\b|\bscreen\b|\bpodium\b/i.test(e.name))
      .map((e) => e.name),
  };
}

export function generateBriefing(
  record: NormalizedBeoRecord,
  changes: OperationalChange[] = [],
  options?: {
    eventId?: string;
    level?: BriefingLevel;
  },
): EventBriefing {
  const level = options?.level ?? "management";

  const briefing: EventBriefing = {
    eventId: options?.eventId,
    headline: buildHeadline(record),
    summary: buildSummary(record),
    keyFacts: buildKeyFacts(record),
    timeline: buildTimeline(record),
    risks: buildRisks(record),
    changes: buildChangeNotes(changes),
    departmentNotes: buildDepartmentNotes(record),
  };

  if (level === "executive") {
    return {
      ...briefing,
      keyFacts: briefing.keyFacts.slice(0, 3),
      timeline: briefing.timeline.slice(0, 3),
      departmentNotes: emptyDepartmentNotes(),
    };
  }

  if (level === "department") {
    return {
      ...briefing,
      summary: "",
      keyFacts: [],
      timeline: briefing.timeline,
      risks: briefing.risks,
      changes: briefing.changes,
      departmentNotes: briefing.departmentNotes,
    };
  }

  return briefing;
}
