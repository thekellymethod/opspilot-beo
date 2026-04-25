/** Version this prompt text; correlate parse quality in `beo_sources.prompt_version`. */
export const BEO_EXTRACTION_PROMPT_VERSION = "2026-04-25-us-beo-v3";

export function buildBeoExtractionPrompt(cleanedText: string, timezone = "America/Chicago"): string {
  return `
You are extracting operational event data from a Banquet Event Order (BEO) or event-related hospitality document.

Return ONLY valid JSON. Do not wrap in markdown. Do not explain. Do not summarize.

Rules:
1. Extract only operational facts present in the source text.
2. If a field is missing or unclear, set value to null.
3. Do not invent staffing counts, menu counts, or times.
4. Normalize serviceStyle to one of:
   - plated
   - buffet
   - stations
   - reception
   - boxed_meal
   - beverage_only
   - unknown
5. Normalize roomSetupStyle to one of:
   - rounds
   - classroom
   - theater
   - boardroom
   - u_shape
   - reception
   - unknown
6. For each field include:
   - value
   - confidence (0 to 1)
   - sourceExcerpt
7. Dates/times:
   - Convert dates where possible to ISO date format YYYY-MM-DD
   - Convert datetimes where possible to ISO 8601 with timezone ${timezone}
   - If only time is present and event date is known, combine them
   - If conversion is not reliable, preserve the string in value
8. If conflicting values appear, choose the most likely value and add a message to extractionWarnings.
9. dietaryNotes should preserve the raw source phrasing.
10. specialRequests and staffingNotes should be arrays when present.
11. criticalMissingFields should include important missing operational fields such as:
    - eventDate
    - roomName
    - guaranteedGuests
    - guestArrivalTime
    - serviceStartTime
    - serviceStyle
12. Marriott-style BEOs often contain table sections and departmental remarks. Extract details from:
    - Time / Function / Room / Set-up / Exp/Gtd / Rental rows
    - BANQUET REMARKS, BILLING INSTRUCTIONS
    - FRONT OFFICE / HOUSEKEEPING / ENGINEERING / KITCHEN / LOSS PREVENTION remarks
    - Team sign-off or approval blocks
13. If Exp/Gtd appears as "500 / 0", preserve expectedGuests=500 and guaranteedGuests=0.

Required JSON shape (camelCase keys):
{
  "eventName": { "value": string | null, "confidence": number | null, "sourceExcerpt": string | null },
  "clientName": { "value": string | null, "confidence": number | null, "sourceExcerpt": string | null },
  "eventType": { "value": string | null, "confidence": number | null, "sourceExcerpt": string | null },
  "eventDate": { "value": string | null, "confidence": number | null, "sourceExcerpt": string | null },
  "timezone": { "value": string | null, "confidence": number | null, "sourceExcerpt": string | null },
  "timeline": {
    "loadInStart": { "value": string | null, "confidence": number | null, "sourceExcerpt": string | null },
    "setupStart": { "value": string | null, "confidence": number | null, "sourceExcerpt": string | null },
    "staffCallTime": { "value": string | null, "confidence": number | null, "sourceExcerpt": string | null },
    "guestArrivalTime": { "value": string | null, "confidence": number | null, "sourceExcerpt": string | null },
    "serviceStartTime": { "value": string | null, "confidence": number | null, "sourceExcerpt": string | null },
    "serviceEndTime": { "value": string | null, "confidence": number | null, "sourceExcerpt": string | null },
    "breakdownStart": { "value": string | null, "confidence": number | null, "sourceExcerpt": string | null },
    "eventEndTime": { "value": string | null, "confidence": number | null, "sourceExcerpt": string | null }
  },
  "venue": {
    "propertyName": { "value": string | null, "confidence": number | null, "sourceExcerpt": string | null },
    "roomName": { "value": string | null, "confidence": number | null, "sourceExcerpt": string | null },
    "roomSetupStyle": { "value": string | null, "confidence": number | null, "sourceExcerpt": string | null },
    "expectedGuests": { "value": number | null, "confidence": number | null, "sourceExcerpt": string | null },
    "guaranteedGuests": { "value": number | null, "confidence": number | null, "sourceExcerpt": string | null }
  },
  "foodBeverage": {
    "serviceStyle": { "value": string | null, "confidence": number | null, "sourceExcerpt": string | null },
    "menu": [
      {
        "course": { "value": string | null, "confidence": number | null, "sourceExcerpt": string | null },
        "item": { "value": string | null, "confidence": number | null, "sourceExcerpt": string | null },
        "count": { "value": number | null, "confidence": number | null, "sourceExcerpt": string | null }
      }
    ],
    "dietaryNotes": [
      {
        "note": { "value": string | null, "confidence": number | null, "sourceExcerpt": string | null }
      }
    ]
  },
  "equipment": [
    {
      "name": { "value": string | null, "confidence": number | null, "sourceExcerpt": string | null },
      "quantity": { "value": number | null, "confidence": number | null, "sourceExcerpt": string | null }
    }
  ],
  "specialRequests": { "value": string[] | null, "confidence": number | null, "sourceExcerpt": string | null },
  "staffingNotes": { "value": string[] | null, "confidence": number | null, "sourceExcerpt": string | null },
  "billingNotes": {
    "minimumRevenue": { "value": number | null, "confidence": number | null, "sourceExcerpt": string | null },
    "depositReceived": { "value": boolean | null, "confidence": number | null, "sourceExcerpt": string | null },
    "finalGuaranteeDue": { "value": string | null, "confidence": number | null, "sourceExcerpt": string | null }
  },
  "criticalMissingFields": string[],
  "extractionWarnings": [
    { "field": string, "message": string }
  ]
}

Source text:
${cleanedText}
`.trim();
}
