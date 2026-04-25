import { formatInTimeZone } from "date-fns-tz";
import type { NormalizedBeoRecord } from "@/lib/beo/types";
import type { ParsedBEO } from "@/lib/types";

function isoToTimeLabel(iso: string | null, timeZone: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return formatInTimeZone(d, timeZone, "HH:mm");
}

/** Maps canonical normalized record to legacy ParsedBEO for task generation / change detection. */
export function normalizedToParsedBEO(n: NormalizedBeoRecord): ParsedBEO {
  const guest_count = n.guaranteedGuests ?? n.expectedGuests ?? 0;

  const timeline: ParsedBEO["timeline"] = [];
  const tz = n.timezone;
  if (n.guestArrivalTime) {
    const t = isoToTimeLabel(n.guestArrivalTime, tz);
    if (t) timeline.push({ time: t, label: "Guest arrival" });
  }
  if (n.serviceStartTime) {
    const t = isoToTimeLabel(n.serviceStartTime, tz);
    if (t) timeline.push({ time: t, label: "Service start" });
  }
  if (n.eventEndTime) {
    const t = isoToTimeLabel(n.eventEndTime, tz);
    if (t) timeline.push({ time: t, label: "Event end" });
  }
  const serviceMap: Record<string, ParsedBEO["service_style"]> = {
    plated: "plated",
    buffet: "buffet",
    stations: "buffet",
    reception: "reception",
    boxed_meal: "other",
    beverage_only: "reception",
    unknown: "other",
  };

  const dietary_notes = [...n.rawDietaryNotes, ...n.dietaryFlags.map((f) => `${f.type}: ${f.originalText}`)];

  const staffingText = n.staffingNotes.join(" ");
  const bartenders = /bar|beverage|cocktail/i.test(staffingText) ? 1 : 0;

  const equipmentStrings = n.equipment.map((e) =>
    e.quantity != null ? `${e.name} x${e.quantity}` : e.name,
  );

  return {
    event_name: n.eventName ?? "",
    client_name: n.clientName ?? "",
    event_date: n.eventDate ?? "",
    room_name: n.roomName ?? "",
    event_type: n.eventType ?? "",
    timeline,
    guest_count,
    service_style: serviceMap[n.serviceStyle] ?? "other",
    staffing: {
      servers_required: guest_count > 100 ? Math.ceil(guest_count / 20) : 0,
      bartenders_required: bartenders,
      kitchen_required: guest_count > 0 ? 1 : 0,
    },
    menu: n.menu.map((row) => ({
      course: row.course ?? "",
      item: row.item ?? "",
      count: row.count ?? 0,
    })),
    dietary_notes,
    equipment: equipmentStrings,
    special_notes: [...n.specialRequests, ...(n.propertyName ? [`Property: ${n.propertyName}`] : [])],
  };
}
