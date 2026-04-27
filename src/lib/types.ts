export type Department = "kitchen" | "banquets" | "bar" | "management" | "setup" | "av" | "engineering" | "housekeeping" | "security" | "front_office";

export type AlertSeverity = "low" | "medium" | "high" | "critical";

export interface ParsedBEO {
  event_name: string;
  client_name: string;
  event_date: string;
  room_name: string;
  event_type: string;
  timeline: Array<{ time: string; label: string }>;
  guest_count: number;
  service_style: "plated" | "buffet" | "reception" | "other";
  staffing: {
    servers_required: number;
    bartenders_required: number;
    kitchen_required: number;
  };
  menu: Array<{ course: string; item: string; count: number }>;
  dietary_notes: string[];
  equipment: string[];
  special_notes: string[];
}

/** Rule-based readiness persisted after promotion or recomputed for command. */
export type EventReadinessSnapshot = {
  score: number;
  level: "ready" | "attention" | "blocked";
  reasons: string[];
  computed_at: string;
};

export interface EventRecord {
  id: string;
  property_id: string | null;
  event_name: string;
  client_name: string;
  event_date: string;
  room_name: string;
  event_type: string;
  status: string;
  current_version_id: string | null;
  created_at: string;
  readiness_snapshot?: EventReadinessSnapshot | null;
}

export interface EventVersionRecord {
  id: string;
  event_id: string;
  version_number: number;
  raw_text: string;
  parsed_json: ParsedBEO;
  /** Canonical normalized snapshot when produced by the BEO pipeline (`NormalizedBeoRecord`). */
  normalized_json?: unknown;
  source_file_url: string | null;
  created_at: string;
}

export interface EventTaskRecord {
  id: string;
  event_id: string;
  department: Department;
  title: string;
  due_at: string | null;
  checklist: string[];
  /** Same length as `checklist` when present; per-line completion for granular progress. */
  checklist_done?: boolean[];
  status: "pending" | "acknowledged" | "blocked" | "complete";
  owner_employee_id?: string | null;
  owner_department?: Department | null;
  assigned_at?: string | null;
  assigned_by?: string | null;
  acknowledged_at?: string | null;
  acknowledged_by?: string | null;
  completed_at?: string | null;
  completed_by_employee_id?: string | null;
  completion_note?: string | null;
  priority?: "low" | "medium" | "high" | "critical";
  /** When true, task is retained for audit but hidden from active operational lists. */
  archived?: boolean;
}

export interface AlertRecord {
  id: string;
  event_id: string;
  severity: AlertSeverity;
  message: string;
  affected_departments: Department[];
  resolved: boolean;
  state?: "new" | "acknowledged" | "resolved" | "escalated";
  owner_employee_id?: string | null;
  owner_department?: Department | null;
  acknowledged_at?: string | null;
  acknowledged_by?: string | null;
  resolved_at?: string | null;
  resolved_by?: string | null;
  escalation_level?: number;
  due_at?: string | null;
  source_version_id?: string | null;
  created_at: string;
}

export interface StaffRosterRecord {
  id: string;
  property_id: string | null;
  staff_name: string;
  department: Department;
  role: string | null;
  shift_date: string;
  available: boolean;
  created_at: string;
}

export interface EventStaffAssignmentRecord {
  id: string;
  event_id: string;
  staff_roster_id: string;
  assigned_at: string;
}

export interface EventChangeViewRecord {
  id: string;
  event_id: string;
  title: string;
  summary: string;
  created_at: string;
}

/** Manager / EM annotations on an event (local JSON store until a DB table exists). */
export interface EventManagerNoteRecord {
  id: string;
  event_id: string;
  /** Free-form tag e.g. timeline, menu, billing, extraction_gap */
  section: string;
  body: string;
  flagged: boolean;
  created_at: string;
  created_by: string | null;
}

export interface EventConfirmationRecord {
  id: string;
  event_id: string;
  version_id: string | null;
  department: Department;
  scope: "briefing" | "ops_plan" | "final_signoff";
  required: boolean;
  acknowledged: boolean;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  note: string | null;
  created_at: string;
}
