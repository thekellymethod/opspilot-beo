import { z } from "zod";

const extractedFieldSchema = <T extends z.ZodTypeAny>(inner: T) =>
  z.object({
    value: inner.nullable(),
    confidence: z.number().min(0).max(1).nullable(),
    sourceExcerpt: z.string().nullable(),
  });

export const serviceStyleSchema = z.enum([
  "plated",
  "buffet",
  "stations",
  "reception",
  "boxed_meal",
  "beverage_only",
  "unknown",
]);

export const roomSetupStyleSchema = z.enum([
  "rounds",
  "classroom",
  "theater",
  "boardroom",
  "u_shape",
  "reception",
  "unknown",
]);

export const extractedWarningSchema = z.object({
  field: z.string().optional(),
  message: z.string(),
});

export const rawBeoExtractionSchema = z.object({
  eventName: extractedFieldSchema(z.string()),
  clientName: extractedFieldSchema(z.string()),
  eventType: extractedFieldSchema(z.string()),
  eventDate: extractedFieldSchema(z.string()),
  timezone: extractedFieldSchema(z.string()),

  timeline: z.object({
    loadInStart: extractedFieldSchema(z.string()),
    setupStart: extractedFieldSchema(z.string()),
    staffCallTime: extractedFieldSchema(z.string()),
    guestArrivalTime: extractedFieldSchema(z.string()),
    serviceStartTime: extractedFieldSchema(z.string()),
    serviceEndTime: extractedFieldSchema(z.string()),
    breakdownStart: extractedFieldSchema(z.string()),
    eventEndTime: extractedFieldSchema(z.string()),
  }),

  venue: z.object({
    propertyName: extractedFieldSchema(z.string()),
    roomName: extractedFieldSchema(z.string()),
    roomSetupStyle: extractedFieldSchema(z.union([roomSetupStyleSchema, z.string()])),
    expectedGuests: extractedFieldSchema(z.number().int()),
    guaranteedGuests: extractedFieldSchema(z.number().int()),
  }),

  foodBeverage: z.object({
    serviceStyle: extractedFieldSchema(z.union([serviceStyleSchema, z.string()])),
    menu: z.array(
      z.object({
        course: extractedFieldSchema(z.string()),
        item: extractedFieldSchema(z.string()),
        count: extractedFieldSchema(z.number().int()),
      }),
    ),
    dietaryNotes: z.array(
      z.object({
        note: extractedFieldSchema(z.string()),
      }),
    ),
  }),

  equipment: z.array(
    z.object({
      name: extractedFieldSchema(z.string()),
      quantity: extractedFieldSchema(z.number().int()),
    }),
  ),

  specialRequests: extractedFieldSchema(z.array(z.string())),
  staffingNotes: extractedFieldSchema(z.array(z.string())),

  billingNotes: z.object({
    minimumRevenue: extractedFieldSchema(z.number()),
    depositReceived: extractedFieldSchema(z.boolean()),
    finalGuaranteeDue: extractedFieldSchema(z.string()),
  }),
  billingInstructions: extractedFieldSchema(z.array(z.string())),
  departmentRemarks: z.array(
    z.object({
      department: extractedFieldSchema(z.string()),
      note: extractedFieldSchema(z.string()),
    }),
  ),
  contacts: z.array(
    z.object({
      role: extractedFieldSchema(z.string()),
      name: extractedFieldSchema(z.string()),
    }),
  ),
  signoffRequirements: z.array(
    z.object({
      role: extractedFieldSchema(z.string()),
      required: extractedFieldSchema(z.boolean()),
      dueAt: extractedFieldSchema(z.string()),
    }),
  ),
  opsRequirements: extractedFieldSchema(z.array(z.string())),

  criticalMissingFields: z.array(z.string()),
  extractionWarnings: z.array(extractedWarningSchema),
});

export type RawBeoExtractionSchema = z.infer<typeof rawBeoExtractionSchema>;

export const normalizedBeoRecordSchema = z.object({
  eventName: z.string().nullable(),
  clientName: z.string().nullable(),
  eventType: z.string().nullable(),
  eventDate: z.string().nullable(),
  timezone: z.string(),
  propertyName: z.string().nullable(),
  roomName: z.string().nullable(),
  roomSetupStyle: roomSetupStyleSchema,
  serviceStyle: serviceStyleSchema,
  expectedGuests: z.number().int().nullable(),
  guaranteedGuests: z.number().int().nullable(),
  loadInStart: z.string().nullable(),
  setupStart: z.string().nullable(),
  staffCallTime: z.string().nullable(),
  guestArrivalTime: z.string().nullable(),
  serviceStartTime: z.string().nullable(),
  serviceEndTime: z.string().nullable(),
  breakdownStart: z.string().nullable(),
  eventEndTime: z.string().nullable(),
  menu: z.array(
    z.object({
      course: z.string().nullable(),
      item: z.string().nullable(),
      count: z.number().int().nullable(),
    }),
  ),
  dietaryFlags: z.array(
    z.object({
      type: z.enum([
        "vegan",
        "vegetarian",
        "gluten_free",
        "dairy_free",
        "nut_allergy",
        "shellfish_allergy",
        "kosher",
        "halal",
        "other",
      ]),
      count: z.number().int().positive(),
      priority: z.enum(["low", "medium", "high", "critical"]),
      originalText: z.string(),
    }),
  ),
  rawDietaryNotes: z.array(z.string()),
  equipment: z.array(
    z.object({
      name: z.string(),
      quantity: z.number().int().nullable(),
    }),
  ),
  specialRequests: z.array(z.string()),
  staffingNotes: z.array(z.string()),
  billingNotes: z.object({
    minimumRevenue: z.number().nullable(),
    depositReceived: z.boolean().nullable(),
    finalGuaranteeDue: z.string().nullable(),
  }),
  billingInstructions: z.array(z.string()),
  departmentRemarks: z.array(
    z.object({
      department: z.string(),
      note: z.string(),
    }),
  ),
  contacts: z.array(
    z.object({
      role: z.string(),
      name: z.string(),
    }),
  ),
  signoffRequirements: z.array(
    z.object({
      role: z.string(),
      required: z.boolean(),
      dueAt: z.string().nullable(),
    }),
  ),
  opsRequirements: z.array(z.string()),
  criticalMissingFields: z.array(z.string()),
  extractionWarnings: z.array(extractedWarningSchema),
  fieldEvidence: z.record(
    z.string(),
    z.object({
      confidence: z.number().min(0).max(1).nullable(),
      sourceExcerpt: z.string().nullable(),
    }),
  ),
});

export type NormalizedBeoRecordSchema = z.infer<typeof normalizedBeoRecordSchema>;
