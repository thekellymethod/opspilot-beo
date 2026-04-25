import OpenAI from "openai";
import { rawBeoExtractionSchema } from "@/lib/beo/schema";
import { buildBeoExtractionPrompt } from "@/lib/beo/prompt";
import type { ExtractedField, RawBeoExtraction } from "@/lib/beo/types";

export type RunBeoExtractionInput = {
  cleanedText: string;
  timezone?: string;
  model?: string;
};

function nullStr(): ExtractedField<string> {
  return { value: null, confidence: null, sourceExcerpt: null };
}

function nullNum(): ExtractedField<number> {
  return { value: null, confidence: null, sourceExcerpt: null };
}

function nullBool(): ExtractedField<boolean> {
  return { value: null, confidence: null, sourceExcerpt: null };
}

function emptyTimeline() {
  return {
    loadInStart: nullStr(),
    setupStart: nullStr(),
    staffCallTime: nullStr(),
    guestArrivalTime: nullStr(),
    serviceStartTime: nullStr(),
    serviceEndTime: nullStr(),
    breakdownStart: nullStr(),
    eventEndTime: nullStr(),
  };
}

function emptyRawExtraction(): RawBeoExtraction {
  return {
    eventName: nullStr(),
    clientName: nullStr(),
    eventType: nullStr(),
    eventDate: nullStr(),
    timezone: nullStr(),
    timeline: emptyTimeline(),
    venue: {
      propertyName: nullStr(),
      roomName: nullStr(),
      roomSetupStyle: nullStr(),
      expectedGuests: nullNum(),
      guaranteedGuests: nullNum(),
    },
    foodBeverage: {
      serviceStyle: nullStr(),
      menu: [],
      dietaryNotes: [],
    },
    equipment: [],
    specialRequests: { value: [], confidence: null, sourceExcerpt: null },
    staffingNotes: { value: [], confidence: null, sourceExcerpt: null },
    billingNotes: {
      minimumRevenue: nullNum(),
      depositReceived: nullBool(),
      finalGuaranteeDue: nullStr(),
    },
    billingInstructions: { value: [], confidence: null, sourceExcerpt: null },
    departmentRemarks: [],
    contacts: [],
    signoffRequirements: [],
    opsRequirements: { value: [], confidence: null, sourceExcerpt: null },
    criticalMissingFields: [],
    extractionWarnings: [],
  };
}

type FunctionTableRow = {
  timeRange: string;
  functionName: string;
  roomName: string;
  setupStyle: string | null;
  expectedGuests: number | null;
  guaranteedGuests: number | null;
};

function parseFunctionRows(lines: string[]): FunctionTableRow[] {
  const rows: FunctionTableRow[] = [];
  for (const line of lines) {
    const m = line.match(
      /(\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})\s+(.+?)\s{2,}(.+?)\s{2,}(.+?)\s{2,}(\d{1,4})\s*\/\s*(\d{1,4})/i,
    );
    if (!m) continue;
    rows.push({
      timeRange: m[1].trim(),
      functionName: m[2].trim(),
      roomName: m[3].trim(),
      setupStyle: m[4].trim(),
      expectedGuests: Number.parseInt(m[5], 10),
      guaranteedGuests: Number.parseInt(m[6], 10),
    });
  }
  return rows;
}

function heuristicRawExtraction(cleanedText: string): RawBeoExtraction {
  const base = emptyRawExtraction();
  const lines = cleanedText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const text = lines.join("\n");

  const labeled = (label: string): string | null => {
    const rx = new RegExp(`${label}\\s*[:\\-]\\s*(.+)`, "i");
    const match = text.match(rx);
    return match?.[1]?.trim() ?? null;
  };
  const firstMatch = (patterns: RegExp[]): string | null => {
    for (const p of patterns) {
      const m = text.match(p);
      if (m?.[1]) return m[1].trim();
      if (m?.[0]) return m[0].trim();
    }
    return null;
  };
  const toIsoDate = (input: string | null): string | null => {
    if (!input) return null;
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  };
  const parseGuestCount = (input: string | null): number | null => {
    if (!input) return null;
    const m = input.match(/\b(\d{1,4})\b/);
    return m ? Number(m[1]) : null;
  };
  const functionRows = parseFunctionRows(lines);

  const eventName =
    labeled("Booking Name") ??
    labeled("Event Name") ??
    firstMatch([/\bFunction\s+([A-Za-z][^\n]{3,80})/i]);
  const clientName = labeled("Account Name") ?? labeled("Client Name");
  const roomName =
    labeled("Room") ??
    firstMatch([/\b(?:Ballroom|Hall|Room|Terrace|Salon)\s*[A-Za-z0-9\- ]{0,20}/i]) ??
    firstMatch([
      /\b\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\s+[A-Za-z][A-Za-z ]+\s+([A-Za-z][A-Za-z0-9 &\-]{2,40})\s+(?:Rounds|Conference|Theater|To Be Advised|Set-?up|Plated|Buffet)/i,
    ]) ??
    null;
  const eventType =
    firstMatch([/\b(Wedding|Meeting|Conference|Dinner|Reception|Breakfast|Lunch)\b/i]) ?? null;
  const expGtd = firstMatch([/\b(\d{1,4}\s*\/\s*\d{1,4})\b/]);
  const expectedGuests = expGtd ? Number(expGtd.split("/")[0].trim()) : null;
  const guaranteedGuests = expGtd ? Number(expGtd.split("/")[1].trim()) : parseGuestCount(labeled("Guaranteed Guests"));

  const dateCandidate =
    labeled("Event Date") ??
    firstMatch([
      /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i,
      /\b(\d{4}-\d{2}-\d{2})\b/,
      /\b(\d{1,2}[\/\-][A-Za-z]{3}[\/\-]\d{2,4})\b/i,
    ]);
  const eventDate = toIsoDate(dateCandidate);

  const serviceStyleRaw = firstMatch([
    /\b(plated dinner|plated service|buffet|stations|reception|boxed meal|beverage only)\b/i,
  ]);
  const serviceStyle = serviceStyleRaw ? serviceStyleRaw.toLowerCase() : null;

  const timelineStart = firstMatch([/\b(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM)?\b/i]);
  const timelineDinner = firstMatch([/\b(?:Dinner|Lunch|Breakfast)\s*(?:at|start[s]?)?\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i]);

  const firstFunctionRow = functionRows[0];
  const functionMenuLines = lines.filter((line) => /\b(soup|appetizers?|salads?|mains?|breads?|desserts?)\b/i.test(line));
  const opsLines = lines.filter((line) =>
    /\b(remarks?|setup|vendor|signage|billing instructions|minimum guarantee|expected guests|event incharge|sales incharge)\b/i.test(
      line,
    ),
  );
  const billingLines = lines.filter((line) => /\b(billing instructions|minimum guarantee|expected guests|mode of payment|surcharge)\b/i.test(line));
  const remarkLines = lines.filter((line) =>
    /\b(front office remarks|housekeeping remarks|engineering remarks|kitchen remarks|systems remarks|loss prevention remarks)\b/i.test(
      line,
    ),
  );
  const contactLines = lines.filter((line) => /\b(event incharge|sales incharge|onsite contact|contact name)\b/i.test(line));

  const dietaryNotes = lines.filter((line) =>
    /(allerg|dietary|vegan|vegetarian|gluten|dairy|nut|halal|kosher)/i.test(line),
  );

  const menuLines = [...lines, ...functionMenuLines]
    .filter((line) => /^(?:-|•|>)\s*/.test(line) || /\b(menu|hors d'oeuvres|entree|dessert|salad|beverage)\b/i.test(line))
    .slice(0, 40);

  if (eventName) base.eventName = { value: eventName, confidence: 0.7, sourceExcerpt: eventName };
  if (clientName) base.clientName = { value: clientName, confidence: 0.7, sourceExcerpt: clientName };
  if (eventType) base.eventType = { value: eventType, confidence: 0.6, sourceExcerpt: eventType };
  if (eventDate) base.eventDate = { value: eventDate, confidence: 0.65, sourceExcerpt: dateCandidate };
  if (roomName) base.venue.roomName = { value: roomName, confidence: 0.6, sourceExcerpt: roomName };
  if (!roomName && firstFunctionRow?.roomName) {
    base.venue.roomName = { value: firstFunctionRow.roomName, confidence: 0.65, sourceExcerpt: firstFunctionRow.roomName };
  }
  if (firstFunctionRow?.setupStyle) {
    base.venue.roomSetupStyle = {
      value: firstFunctionRow.setupStyle,
      confidence: 0.6,
      sourceExcerpt: firstFunctionRow.setupStyle,
    };
  }
  if (expectedGuests != null) {
    base.venue.expectedGuests = { value: expectedGuests, confidence: 0.6, sourceExcerpt: expGtd ?? String(expectedGuests) };
  }
  if (guaranteedGuests != null) {
    base.venue.guaranteedGuests = {
      value: guaranteedGuests,
      confidence: 0.6,
      sourceExcerpt: expGtd ?? String(guaranteedGuests),
    };
  }
  if (serviceStyle) {
    base.foodBeverage.serviceStyle = { value: serviceStyle, confidence: 0.55, sourceExcerpt: serviceStyleRaw };
  }
  if (!serviceStyle && firstFunctionRow?.functionName) {
    base.foodBeverage.serviceStyle = {
      value: /buffet/i.test(firstFunctionRow.functionName) ? "buffet" : "unknown",
      confidence: 0.45,
      sourceExcerpt: firstFunctionRow.functionName,
    };
  }
  if (timelineStart) {
    base.timeline.guestArrivalTime = { value: timelineStart, confidence: 0.45, sourceExcerpt: timelineStart };
  }
  if (timelineDinner) {
    base.timeline.serviceStartTime = { value: timelineDinner, confidence: 0.45, sourceExcerpt: timelineDinner };
  }
  if (dietaryNotes.length > 0) {
    base.foodBeverage.dietaryNotes = dietaryNotes.map((note) => ({
      note: { value: note, confidence: 0.55, sourceExcerpt: note },
    }));
  }
  if (menuLines.length > 0) {
    base.foodBeverage.menu = menuLines.slice(0, 30).map((line) => ({
      course: { value: null, confidence: null, sourceExcerpt: line },
      item: { value: line.replace(/^(?:-|•|>)\s*/, ""), confidence: 0.4, sourceExcerpt: line },
      count: { value: null, confidence: null, sourceExcerpt: line },
    }));
  }
  if (opsLines.length > 0) {
    base.staffingNotes = {
      value: opsLines.slice(0, 20),
      confidence: 0.45,
      sourceExcerpt: opsLines.slice(0, 3).join(" | "),
    };
  }
  if (billingLines.length > 0) {
    base.billingInstructions = {
      value: billingLines.slice(0, 20),
      confidence: 0.45,
      sourceExcerpt: billingLines.slice(0, 3).join(" | "),
    };
  }
  if (remarkLines.length > 0) {
    base.departmentRemarks = remarkLines.map((line) => ({
      department: { value: line.replace(/remarks?/i, "").trim(), confidence: 0.4, sourceExcerpt: line },
      note: { value: line, confidence: 0.4, sourceExcerpt: line },
    }));
  }
  if (contactLines.length > 0) {
    base.contacts = contactLines.map((line) => {
      const [rolePart, namePart] = line.split(":");
      return {
        role: { value: rolePart?.trim() ?? "contact", confidence: 0.45, sourceExcerpt: line },
        name: { value: namePart?.trim() ?? line.trim(), confidence: 0.45, sourceExcerpt: line },
      };
    });
  }
  const signoffRoles = lines.filter((line) => /\b(director of events|event manager|coordinator|sign-?off)\b/i.test(line));
  if (signoffRoles.length > 0) {
    base.signoffRequirements = signoffRoles.map((line) => ({
      role: { value: line.split(":")[0]?.trim() ?? line.trim(), confidence: 0.5, sourceExcerpt: line },
      required: { value: true, confidence: 0.7, sourceExcerpt: line },
      dueAt: { value: line.split(":")[1]?.trim() ?? null, confidence: 0.4, sourceExcerpt: line },
    }));
  }
  if (opsLines.length > 0) {
    base.opsRequirements = {
      value: opsLines.slice(0, 30),
      confidence: 0.45,
      sourceExcerpt: opsLines.slice(0, 3).join(" | "),
    };
  }

  const missing = [];
  if (!base.eventName.value) missing.push("eventName");
  if (!base.eventDate.value) missing.push("eventDate");
  if (!base.venue.roomName.value) missing.push("roomName");
  if (!base.foodBeverage.serviceStyle.value) missing.push("serviceStyle");
  if (base.venue.guaranteedGuests.value == null && base.venue.expectedGuests.value == null) missing.push("guaranteedGuests");

  base.extractionWarnings = [
    { message: "Model extraction was incomplete; heuristic backfill used for missing fields. Verify key values." },
  ];
  base.criticalMissingFields = missing;
  return rawBeoExtractionSchema.parse(base);
}

function fillIfMissing<T>(primary: ExtractedField<T>, fallback: ExtractedField<T>) {
  return primary.value === null || primary.value === undefined || primary.value === "" ? fallback : primary;
}

export function enhanceRawExtractionWithHeuristics(extraction: RawBeoExtraction, cleanedText: string): RawBeoExtraction {
  const fallback = heuristicRawExtraction(cleanedText);
  const merged: RawBeoExtraction = {
    ...extraction,
    eventName: fillIfMissing(extraction.eventName, fallback.eventName),
    clientName: fillIfMissing(extraction.clientName, fallback.clientName),
    eventType: fillIfMissing(extraction.eventType, fallback.eventType),
    eventDate: fillIfMissing(extraction.eventDate, fallback.eventDate),
    venue: {
      ...extraction.venue,
      roomName: fillIfMissing(extraction.venue.roomName, fallback.venue.roomName),
      expectedGuests: fillIfMissing(extraction.venue.expectedGuests, fallback.venue.expectedGuests),
      guaranteedGuests: fillIfMissing(extraction.venue.guaranteedGuests, fallback.venue.guaranteedGuests),
    },
    timeline: {
      ...extraction.timeline,
      guestArrivalTime: fillIfMissing(extraction.timeline.guestArrivalTime, fallback.timeline.guestArrivalTime),
      serviceStartTime: fillIfMissing(extraction.timeline.serviceStartTime, fallback.timeline.serviceStartTime),
    },
    foodBeverage: {
      ...extraction.foodBeverage,
      serviceStyle: fillIfMissing(extraction.foodBeverage.serviceStyle, fallback.foodBeverage.serviceStyle),
      menu: extraction.foodBeverage.menu.length > 0 ? extraction.foodBeverage.menu : fallback.foodBeverage.menu,
      dietaryNotes:
        extraction.foodBeverage.dietaryNotes.length > 0 ? extraction.foodBeverage.dietaryNotes : fallback.foodBeverage.dietaryNotes,
    },
    billingInstructions:
      extraction.billingInstructions.value && extraction.billingInstructions.value.length > 0
        ? extraction.billingInstructions
        : fallback.billingInstructions,
    departmentRemarks: extraction.departmentRemarks.length > 0 ? extraction.departmentRemarks : fallback.departmentRemarks,
    contacts: extraction.contacts.length > 0 ? extraction.contacts : fallback.contacts,
    signoffRequirements: extraction.signoffRequirements.length > 0 ? extraction.signoffRequirements : fallback.signoffRequirements,
    opsRequirements:
      extraction.opsRequirements.value && extraction.opsRequirements.value.length > 0
        ? extraction.opsRequirements
        : fallback.opsRequirements,
    extractionWarnings: [...(extraction.extractionWarnings ?? []), ...(fallback.extractionWarnings ?? [])],
  };
  return rawBeoExtractionSchema.parse(merged);
}

function safeJsonParse(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    const stripped = input
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    return JSON.parse(stripped);
  }
}

export async function runBeoExtraction({
  cleanedText,
  timezone = "America/Chicago",
  model = "gpt-4.1-mini",
}: RunBeoExtractionInput): Promise<RawBeoExtraction> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return heuristicRawExtraction(cleanedText);
  }

  const client = new OpenAI({ apiKey });
  const prompt = buildBeoExtractionPrompt(cleanedText, timezone);
  const resolvedModel = process.env.OPENAI_MODEL ?? model;

  const response = await client.responses.create({
    model: resolvedModel,
    input: [
      {
        role: "system",
        content: "You extract structured operational event data from hospitality documents. Output JSON only.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0,
  });

  const text = response.output_text?.trim();
  if (!text) {
    return heuristicRawExtraction(cleanedText);
  }

  try {
    const parsed = safeJsonParse(text);
    const validated = rawBeoExtractionSchema.safeParse(parsed);
    if (!validated.success) {
      return heuristicRawExtraction(cleanedText);
    }
    return enhanceRawExtractionWithHeuristics(validated.data, cleanedText);
  } catch {
    return heuristicRawExtraction(cleanedText);
  }
}
