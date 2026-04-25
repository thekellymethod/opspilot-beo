export interface PropertyProfile {
  property_id: string;
  timezone: string;
  field_aliases: Record<string, string>;
  common_room_names: string[];
  service_aliases: Record<string, string>;
  room_capacity_by_room?: Record<string, number>;
  staffing_capacity?: {
    servers: number;
    bartenders: number;
    kitchen: number;
  };
}

const DEFAULT_PROFILE: PropertyProfile = {
  property_id: "default",
  timezone: "America/Chicago",
  field_aliases: {
    attendance: "expected_guests",
    guarantee: "guaranteed_guests",
    "final guarantee": "guaranteed_guests",
    function_room: "room_name",
    "function space": "room_name",
  },
  common_room_names: [],
  service_aliases: {
    "plated entree": "plated",
    "plated dinner": "plated",
    "plated meal": "plated",
    "buffet service": "buffet",
    stations: "stations",
    reception: "reception",
    "boxed lunch": "boxed_meal",
    "beverage only": "beverage_only",
  },
  staffing_capacity: {
    servers: 0,
    bartenders: 0,
    kitchen: 0,
  },
};

export function loadPropertyProfile(propertyId: string | null): PropertyProfile {
  const raw = process.env.BEO_PROPERTY_PROFILE_JSON;
  if (!raw) {
    return { ...DEFAULT_PROFILE, property_id: propertyId ?? DEFAULT_PROFILE.property_id };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<PropertyProfile>;
    return {
      ...DEFAULT_PROFILE,
      ...parsed,
      property_id: propertyId ?? parsed.property_id ?? DEFAULT_PROFILE.property_id,
      field_aliases: { ...DEFAULT_PROFILE.field_aliases, ...parsed.field_aliases },
      service_aliases: { ...DEFAULT_PROFILE.service_aliases, ...parsed.service_aliases },
      common_room_names: parsed.common_room_names ?? DEFAULT_PROFILE.common_room_names,
      room_capacity_by_room: parsed.room_capacity_by_room ?? DEFAULT_PROFILE.room_capacity_by_room,
    };
  } catch {
    return { ...DEFAULT_PROFILE, property_id: propertyId ?? DEFAULT_PROFILE.property_id };
  }
}
