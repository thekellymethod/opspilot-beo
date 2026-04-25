import { createClient } from "@supabase/supabase-js";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { OperationalChange } from "@/lib/beo/changeDetector";
import type { EventBriefing } from "@/lib/beo/briefingGenerator";
import type { NormalizedBeoRecord, ValidationResult } from "@/lib/beo/types";
import type {
  AlertRecord,
  EventChangeViewRecord,
  EventConfirmationRecord,
  EventReadinessSnapshot,
  EventRecord,
  EventStaffAssignmentRecord,
  EventTaskRecord,
  EventVersionRecord,
  ParsedBEO,
  StaffRosterRecord,
} from "@/lib/types";

const memory = {
  events: [] as EventRecord[],
  versions: [] as EventVersionRecord[],
  tasks: [] as EventTaskRecord[],
  alerts: [] as AlertRecord[],
  staffRoster: [] as StaffRosterRecord[],
  eventStaffAssignments: [] as EventStaffAssignmentRecord[],
  eventChangeViews: [] as EventChangeViewRecord[],
  briefings: [] as EventBriefingRow[],
  activities: [] as EventActivityRow[],
  confirmations: [] as EventConfirmationRecord[],
};

const LOCAL_STORE_PATH = path.join(process.cwd(), ".opspilot-local-store.json");

async function loadLocalEventState(): Promise<void> {
  try {
    const raw = await fs.readFile(LOCAL_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<typeof memory>;
    if (Array.isArray(parsed.events)) memory.events = parsed.events as EventRecord[];
    if (Array.isArray(parsed.versions)) memory.versions = parsed.versions as EventVersionRecord[];
    if (Array.isArray(parsed.tasks)) memory.tasks = parsed.tasks as EventTaskRecord[];
    if (Array.isArray(parsed.alerts)) memory.alerts = parsed.alerts as AlertRecord[];
    if (Array.isArray(parsed.staffRoster)) memory.staffRoster = parsed.staffRoster as import("@/lib/types").StaffRosterRecord[];
    if (Array.isArray(parsed.eventStaffAssignments)) {
      memory.eventStaffAssignments = parsed.eventStaffAssignments as EventStaffAssignmentRecord[];
    }
    if (Array.isArray(parsed.eventChangeViews)) {
      memory.eventChangeViews = parsed.eventChangeViews as EventChangeViewRecord[];
    }
    if (Array.isArray(parsed.confirmations)) {
      memory.confirmations = parsed.confirmations as EventConfirmationRecord[];
    }
  } catch {
    // No local store yet; keep in-memory defaults.
  }
}

async function persistLocalEventState(): Promise<void> {
  const payload = {
    events: memory.events,
    versions: memory.versions,
    tasks: memory.tasks,
    alerts: memory.alerts,
    staffRoster: memory.staffRoster,
    eventStaffAssignments: memory.eventStaffAssignments,
    eventChangeViews: memory.eventChangeViews,
    confirmations: memory.confirmations,
  };
  await fs.writeFile(LOCAL_STORE_PATH, JSON.stringify(payload, null, 2), "utf8");
}

export type EventBriefingRow = {
  id: string;
  event_id: string;
  version_id: string;
  briefing_management: EventBriefing;
  department_summaries: Record<string, string[]>;
  operational_changes: OperationalChange[];
  validation: ValidationResult | null;
  promoted_by: string | null;
  created_at: string;
};

export type EventActivityRow = {
  id: string;
  event_id: string;
  actor_label: string | null;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
};

function hasSupabaseConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function hasPersistentStoreConfig(): boolean {
  return hasSupabaseConfig();
}

const SUPABASE_FETCH_TIMEOUT_MS = (() => {
  const n = Number(process.env.SUPABASE_FETCH_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 120_000) : 12_000;
})();

/**
 * Supabase uses `fetch` under the hood; without a timeout a bad network or pooler
 * can block RSC for 30–60s+. Cap each HTTP leg so pages stay responsive.
 */
async function supabaseBoundedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    const err = new Error(`Supabase request timed out after ${SUPABASE_FETCH_TIMEOUT_MS}ms`);
    err.name = "TimeoutError";
    controller.abort(err);
  }, SUPABASE_FETCH_TIMEOUT_MS);

  const parent = init?.signal;
  const onParentAbort = () => {
    clearTimeout(timer);
    controller.abort(parent?.reason);
  };

  if (parent) {
    if (parent.aborted) {
      clearTimeout(timer);
      return Promise.reject(parent.reason);
    }
    parent.addEventListener("abort", onParentAbort, { once: true });
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    parent?.removeEventListener("abort", onParentAbort);
  }
}

let supabaseClient: any = null;

function getSupabaseClient(): any {
  if (!hasSupabaseConfig()) {
    return null;
  }
  if (!supabaseClient) {
    supabaseClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
      global: { fetch: supabaseBoundedFetch },
    });
  }
  return supabaseClient;
}

function formatSupabaseWriteError(table: "events" | "event_versions", operation: "upsert" | "insert" | "update", message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("does not exist") || lower.includes("42p01")) {
    return `Supabase ${operation} failed on ${table}: table missing. Run supabase/schema.sql. Original error: ${message}`;
  }
  if (lower.includes("violates row-level security policy") || lower.includes("permission denied")) {
    return `Supabase ${operation} failed on ${table}: policy/permission issue. Verify service-role key and RLS config. Original error: ${message}`;
  }
  if (
    lower.includes("invalid input syntax") ||
    lower.includes("violates not-null constraint") ||
    lower.includes("violates foreign key constraint")
  ) {
    return `Supabase ${operation} failed on ${table}: data/constraint mismatch. Verify payload types and required columns in supabase/schema.sql. Original error: ${message}`;
  }
  return `Supabase ${operation} failed on ${table}. Original error: ${message}`;
}

const EVENT_LIST_COLUMNS =
  "id, property_id, event_name, client_name, event_date, room_name, event_type, status, current_version_id, created_at, readiness_snapshot";

export async function listEventsForDate(dateISO: string): Promise<EventRecord[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    await loadLocalEventState();
    return memory.events.filter((event) => event.event_date === dateISO);
  }
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_LIST_COLUMNS)
    .eq("event_date", dateISO)
    .order("created_at");
  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[listEventsForDate]", error.message);
    }
    return [];
  }
  return (data ?? []) as EventRecord[];
}

export async function listUpcomingEvents(startDateISO: string, daysAhead = 30): Promise<EventRecord[]> {
  const supabase = getSupabaseClient();
  const end = new Date(`${startDateISO}T12:00:00`);
  end.setDate(end.getDate() + Math.max(1, daysAhead));
  const endDateISO = end.toISOString().slice(0, 10);

  if (!supabase) {
    await loadLocalEventState();
    return memory.events
      .filter((event) => event.event_date >= startDateISO && event.event_date <= endDateISO)
      .sort((a, b) => (a.event_date < b.event_date ? -1 : 1));
  }

  const { data, error } = await supabase
    .from("events")
    .select(EVENT_LIST_COLUMNS)
    .gte("event_date", startDateISO)
    .lte("event_date", endDateISO)
    .order("event_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[listUpcomingEvents]", error.message);
    }
    return [];
  }
  return (data ?? []) as EventRecord[];
}

export type ListEventTasksOptions = {
  includeArchived?: boolean;
};

export async function listEventTasks(
  eventId: string,
  options?: ListEventTasksOptions,
): Promise<EventTaskRecord[]> {
  const includeArchived = options?.includeArchived ?? false;
  const supabase = getSupabaseClient();
  if (!supabase) {
    await loadLocalEventState();
    return memory.tasks.filter((task) => {
      if (task.event_id !== eventId) return false;
      if (!includeArchived && task.archived) return false;
      return true;
    });
  }
  let q = supabase.from("event_tasks").select("*").eq("event_id", eventId).order("department");
  if (!includeArchived) {
    q = q.eq("archived", false);
  }
  const { data } = await q;
  return (data ?? []) as EventTaskRecord[];
}

export async function listAlerts(eventId: string): Promise<AlertRecord[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    await loadLocalEventState();
    return memory.alerts.filter((alert) => alert.event_id === eventId);
  }
  const { data } = await supabase.from("alerts").select("*").eq("event_id", eventId).order("created_at", { ascending: false });
  return (data ?? []) as AlertRecord[];
}

export async function listAvailableStaffForDate(
  shiftDate: string,
  propertyId?: string | null,
): Promise<StaffRosterRecord[]> {
  return listStaffRosterForDate(shiftDate, propertyId, { includeUnavailable: false });
}

export async function listStaffRosterForDate(
  shiftDate: string,
  propertyId?: string | null,
  options?: { includeUnavailable?: boolean },
): Promise<StaffRosterRecord[]> {
  const includeUnavailable = options?.includeUnavailable ?? false;
  const supabase = getSupabaseClient();
  if (!supabase) {
    await loadLocalEventState();
    return memory.staffRoster.filter((row) => {
      if (!includeUnavailable && !row.available) return false;
      if (row.shift_date !== shiftDate) return false;
      if (propertyId && row.property_id && row.property_id !== propertyId) return false;
      return true;
    });
  }

  let q = supabase.from("staff_roster").select("*").eq("shift_date", shiftDate).order("department");
  if (propertyId) {
    q = q.eq("property_id", propertyId);
  }
  if (!includeUnavailable) {
    q = q.eq("available", true);
  }
  const { data, error } = await q;
  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[listStaffRosterForDate]", error.message);
    }
    return [];
  }
  return (data ?? []) as StaffRosterRecord[];
}

export async function insertStaffRoster(
  entries: Array<Omit<StaffRosterRecord, "id" | "created_at">>,
): Promise<StaffRosterRecord[]> {
  if (entries.length === 0) return [];
  const supabase = getSupabaseClient();
  const rows: StaffRosterRecord[] = entries.map((entry) => ({
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    ...entry,
  }));

  if (!supabase) {
    await loadLocalEventState();
    memory.staffRoster.push(...rows);
    await persistLocalEventState();
    return rows;
  }

  const { data, error } = await (supabase
    .from("staff_roster") as any)
    .insert(
      rows.map((row) => ({
        id: row.id,
        property_id: row.property_id,
        staff_name: row.staff_name,
        department: row.department,
        role: row.role,
        shift_date: row.shift_date,
        available: row.available,
      })),
    )
    .select("*");
  if (error) throw new Error(error.message);
  return (data ?? []) as StaffRosterRecord[];
}

export async function updateStaffRosterAvailability(id: string, available: boolean): Promise<StaffRosterRecord | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    await loadLocalEventState();
    const row = memory.staffRoster.find((item) => item.id === id);
    if (!row) return null;
    row.available = available;
    await persistLocalEventState();
    return row;
  }

  const { data, error } = await (supabase
    .from("staff_roster") as any)
    .update({ available })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as StaffRosterRecord | null) ?? null;
}

export async function deleteStaffRosterEntry(id: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    await loadLocalEventState();
    const before = memory.staffRoster.length;
    memory.staffRoster = memory.staffRoster.filter((item) => item.id !== id);
    await persistLocalEventState();
    return memory.staffRoster.length < before;
  }

  const { error } = await (supabase.from("staff_roster") as any).delete().eq("id", id);
  if (error) throw new Error(error.message);
  return true;
}

export async function getStaffRosterById(id: string): Promise<StaffRosterRecord | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    await loadLocalEventState();
    return memory.staffRoster.find((row) => row.id === id) ?? null;
  }
  const { data, error } = await (supabase.from("staff_roster") as any).select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as StaffRosterRecord | null) ?? null;
}

export async function listEventStaffAssignments(eventId: string): Promise<EventStaffAssignmentRecord[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    await loadLocalEventState();
    return memory.eventStaffAssignments
      .filter((row) => row.event_id === eventId)
      .sort((a, b) => (a.assigned_at < b.assigned_at ? 1 : -1));
  }
  const { data, error } = await supabase
    .from("event_staff_assignments")
    .select("*")
    .eq("event_id", eventId)
    .order("assigned_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as EventStaffAssignmentRecord[];
}

export async function assignStaffToEvent(eventId: string, staffRosterId: string): Promise<EventStaffAssignmentRecord> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    await loadLocalEventState();
    const existing = memory.eventStaffAssignments.find(
      (row) => row.event_id === eventId && row.staff_roster_id === staffRosterId,
    );
    if (existing) return existing;
    const record: EventStaffAssignmentRecord = {
      id: crypto.randomUUID(),
      event_id: eventId,
      staff_roster_id: staffRosterId,
      assigned_at: new Date().toISOString(),
    };
    memory.eventStaffAssignments.push(record);
    await persistLocalEventState();
    return record;
  }

  const { data, error } = await supabase
    .from("event_staff_assignments")
    .upsert(
      {
        id: crypto.randomUUID(),
        event_id: eventId,
        staff_roster_id: staffRosterId,
      },
      { onConflict: "event_id,staff_roster_id" },
    )
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as EventStaffAssignmentRecord;
}

export async function removeStaffAssignmentFromEvent(eventId: string, staffRosterId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    await loadLocalEventState();
    memory.eventStaffAssignments = memory.eventStaffAssignments.filter(
      (row) => !(row.event_id === eventId && row.staff_roster_id === staffRosterId),
    );
    await persistLocalEventState();
    return;
  }
  const { error } = await supabase
    .from("event_staff_assignments")
    .delete()
    .eq("event_id", eventId)
    .eq("staff_roster_id", staffRosterId);
  if (error) throw new Error(error.message);
}

export async function saveEventChangeView(eventId: string, title: string, summary: string): Promise<EventChangeViewRecord> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    await loadLocalEventState();
    const record: EventChangeViewRecord = {
      id: crypto.randomUUID(),
      event_id: eventId,
      title,
      summary,
      created_at: new Date().toISOString(),
    };
    memory.eventChangeViews.push(record);
    await persistLocalEventState();
    return record;
  }
  const { data, error } = await supabase
    .from("event_change_views")
    .insert({ id: crypto.randomUUID(), event_id: eventId, title, summary })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as EventChangeViewRecord;
}

export async function getLatestEventChangeView(eventId: string): Promise<EventChangeViewRecord | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    await loadLocalEventState();
    const rows = memory.eventChangeViews
      .filter((row) => row.event_id === eventId)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return rows[0] ?? null;
  }
  const { data, error } = await supabase
    .from("event_change_views")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as EventChangeViewRecord | null) ?? null;
}

export async function getEvent(eventId: string): Promise<EventRecord | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    await loadLocalEventState();
    return memory.events.find((event) => event.id === eventId) ?? null;
  }
  const { data } = await supabase.from("events").select("*").eq("id", eventId).maybeSingle();
  return (data as EventRecord | null) ?? null;
}

export async function getEventVersionById(versionId: string): Promise<EventVersionRecord | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    await loadLocalEventState();
    return memory.versions.find((v) => v.id === versionId) ?? null;
  }
  const { data } = await supabase.from("event_versions").select("*").eq("id", versionId).maybeSingle();
  return (data as EventVersionRecord | null) ?? null;
}

export async function listEventVersions(eventId: string): Promise<EventVersionRecord[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    await loadLocalEventState();
    return memory.versions
      .filter((v) => v.event_id === eventId)
      .sort((a, b) => b.version_number - a.version_number);
  }
  const { data } = await supabase
    .from("event_versions")
    .select("*")
    .eq("event_id", eventId)
    .order("version_number", { ascending: false });
  return (data ?? []) as EventVersionRecord[];
}

/** Current operational version: `events.current_version_id`, else highest `version_number`. */
export async function getPinnedOrLatestVersion(eventId: string): Promise<EventVersionRecord | null> {
  const event = await getEvent(eventId);
  if (event?.current_version_id) {
    const pinned = await getEventVersionById(event.current_version_id);
    if (pinned && pinned.event_id === eventId) return pinned;
  }
  return getLatestVersion(eventId);
}

export async function getPriorVersionByNumber(
  eventId: string,
  currentVersionNumber: number,
): Promise<EventVersionRecord | null> {
  const versions = await listEventVersions(eventId);
  return versions.find((v) => v.version_number < currentVersionNumber) ?? null;
}

export async function setEventCurrentVersion(eventId: string, versionId: string | null): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    await loadLocalEventState();
    const ev = memory.events.find((e) => e.id === eventId);
    if (ev) ev.current_version_id = versionId;
    await persistLocalEventState();
    return;
  }
  await supabase.from("events").update({ current_version_id: versionId }).eq("id", eventId);
}

export async function updateEventReadiness(
  eventId: string,
  snapshot: EventReadinessSnapshot,
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    const ev = memory.events.find((e) => e.id === eventId);
    if (ev) {
      (ev as EventRecord).readiness_snapshot = snapshot;
    }
    return;
  }
  const { error } = await supabase
    .from("events")
    .update({ readiness_snapshot: snapshot })
    .eq("id", eventId);
  if (error) throw new Error(error.message);
}

export async function archivePendingTasksForEvent(eventId: string): Promise<number> {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();
  if (!supabase) {
    await loadLocalEventState();
    let n = 0;
    for (const t of memory.tasks) {
      if (t.event_id === eventId && t.status === "pending" && !t.archived) {
        t.archived = true;
        n += 1;
      }
    }
    await persistLocalEventState();
    return n;
  }
  const { data, error } = await supabase
    .from("event_tasks")
    .update({ archived: true })
    .eq("event_id", eventId)
    .eq("status", "pending")
    .eq("archived", false)
    .select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

export async function insertEventTasks(tasks: EventTaskRecord[]): Promise<EventTaskRecord[]> {
  if (tasks.length === 0) return [];
  const supabase = getSupabaseClient();
  const rows = tasks.map((t) => ({
    ...t,
    archived: t.archived ?? false,
  }));
  if (!supabase) {
    await loadLocalEventState();
    memory.tasks.push(...rows);
    await persistLocalEventState();
    return rows;
  }
  const { error } = await supabase.from("event_tasks").insert(rows);
  if (error) throw new Error(error.message);
  return rows;
}

export async function getEventTaskById(taskId: string): Promise<EventTaskRecord | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    await loadLocalEventState();
    return memory.tasks.find((t) => t.id === taskId) ?? null;
  }
  const { data } = await supabase.from("event_tasks").select("*").eq("id", taskId).maybeSingle();
  return (data as EventTaskRecord | null) ?? null;
}

export async function updateEventTask(
  taskId: string,
  patch: Partial<
    Pick<
      EventTaskRecord,
      | "status"
      | "archived"
      | "owner_employee_id"
      | "owner_department"
      | "assigned_at"
      | "assigned_by"
      | "acknowledged_at"
      | "acknowledged_by"
      | "completed_at"
      | "completed_by_employee_id"
      | "completion_note"
      | "priority"
    >
  >,
): Promise<EventTaskRecord | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    await loadLocalEventState();
    const t = memory.tasks.find((x) => x.id === taskId);
    if (!t) return null;
    Object.assign(t, patch);
    await persistLocalEventState();
    return t;
  }
  const { data, error } = await supabase.from("event_tasks").update(patch).eq("id", taskId).select("*").maybeSingle();
  if (error) throw new Error(error.message);
  return (data as EventTaskRecord | null) ?? null;
}

export async function insertEventBriefing(row: Omit<EventBriefingRow, "id" | "created_at">): Promise<EventBriefingRow> {
  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();
  const record: EventBriefingRow = {
    id,
    created_at,
    ...row,
  };
  const supabase = getSupabaseClient();
  if (!supabase) {
    memory.briefings.push(record);
    return record;
  }
  const { error } = await supabase.from("event_briefings").insert({
    id: record.id,
    event_id: record.event_id,
    version_id: record.version_id,
    briefing_management: record.briefing_management,
    department_summaries: record.department_summaries,
    operational_changes: record.operational_changes,
    validation: record.validation,
    promoted_by: record.promoted_by,
    created_at: record.created_at,
  });
  if (error) throw new Error(error.message);
  return record;
}

export async function getLatestEventBriefing(eventId: string): Promise<EventBriefingRow | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    const rows = memory.briefings
      .filter((b) => b.event_id === eventId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return rows[0] ?? null;
  }
  const { data } = await supabase
    .from("event_briefings")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const r = data as Record<string, unknown>;
  const rawChanges = r.operational_changes;
  const operational_changes = Array.isArray(rawChanges)
    ? (rawChanges as OperationalChange[])
    : [];

  return {
    id: String(r.id),
    event_id: String(r.event_id),
    version_id: String(r.version_id),
    briefing_management: r.briefing_management as EventBriefing,
    department_summaries: (r.department_summaries as Record<string, string[]>) ?? {},
    operational_changes,
    validation: (r.validation as ValidationResult | null) ?? null,
    promoted_by: (r.promoted_by as string | null) ?? null,
    created_at: String(r.created_at),
  };
}

export async function appendEventActivities(entries: Omit<EventActivityRow, "id" | "created_at">[]): Promise<void> {
  if (entries.length === 0) return;
  const supabase = getSupabaseClient();
  const rows: EventActivityRow[] = entries.map((e) => ({
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    ...e,
  }));
  if (!supabase) {
    memory.activities.push(...rows);
    return;
  }
  const { error } = await supabase.from("event_activity").insert(
    rows.map((r) => ({
      id: r.id,
      event_id: r.event_id,
      actor_label: r.actor_label,
      action: r.action,
      details: r.details,
      created_at: r.created_at,
    })),
  );
  if (error) throw new Error(error.message);
}

export async function listEventAcknowledgments(eventId: string): Promise<
  Array<{
    id: string;
    event_id: string;
    department: string;
    acknowledged: boolean;
    acknowledged_at: string | null;
    acknowledged_by: string | null;
  }>
> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("event_acknowledgments").select("*").eq("event_id", eventId);
  if (error) return [];
  return (data ?? []) as Array<{
    id: string;
    event_id: string;
    department: string;
    acknowledged: boolean;
    acknowledged_at: string | null;
    acknowledged_by: string | null;
  }>;
}

export async function listEventActivity(eventId: string, limit = 50): Promise<EventActivityRow[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return memory.activities
      .filter((a) => a.event_id === eventId)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, limit);
  }
  const { data } = await supabase
    .from("event_activity")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    event_id: String(r.event_id),
    actor_label: (r.actor_label as string | null) ?? null,
    action: String(r.action),
    details: (r.details as Record<string, unknown>) ?? {},
    created_at: String(r.created_at),
  }));
}

export async function getLatestVersion(eventId: string): Promise<EventVersionRecord | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    await loadLocalEventState();
    return memory.versions
      .filter((version) => version.event_id === eventId)
      .sort((a, b) => b.version_number - a.version_number)[0] ?? null;
  }
  const { data } = await supabase
    .from("event_versions")
    .select("*")
    .eq("event_id", eventId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as EventVersionRecord | null) ?? null;
}

export async function getPreviousVersion(eventId: string): Promise<EventVersionRecord | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    await loadLocalEventState();
    return memory.versions
      .filter((version) => version.event_id === eventId)
      .sort((a, b) => b.version_number - a.version_number)[1] ?? null;
  }
  const { data } = await supabase
    .from("event_versions")
    .select("*")
    .eq("event_id", eventId)
    .order("version_number", { ascending: false })
    .limit(2);
  return ((data ?? [])[1] as EventVersionRecord | undefined) ?? null;
}

export async function saveVersion(input: {
  rawText: string;
  parsed: ParsedBEO;
  normalized?: NormalizedBeoRecord | null;
  sourceUrl?: string | null;
  /** When re-processing from an existing BEO source / event link. */
  eventIdHint?: string | null;
}) {
  const supabase = getSupabaseClient();
  /**
   * Never auto-merge by title/date heuristics.
   * Revisions only attach to an existing event via explicit eventIdHint
   * (e.g. linked source reprocessing or manual promotion flow).
   */
  const existingEvent = input.eventIdHint ? memory.events.find((e) => e.id === input.eventIdHint) : undefined;
  const eventId = existingEvent?.id ?? input.eventIdHint ?? crypto.randomUUID();

  const event: EventRecord = {
    id: eventId,
    property_id: null,
    event_name: input.parsed.event_name,
    client_name: input.parsed.client_name,
    event_date: input.parsed.event_date,
    room_name: input.parsed.room_name,
    event_type: input.parsed.event_type,
    status: "active",
    current_version_id: null,
    created_at: new Date().toISOString(),
  };

  const currentVersions = memory.versions.filter((version) => version.event_id === eventId);
  const nextVersion = Math.max(0, ...currentVersions.map((version) => version.version_number)) + 1;
  const versionRecord: EventVersionRecord = {
    id: crypto.randomUUID(),
    event_id: eventId,
    version_number: nextVersion,
    raw_text: input.rawText,
    parsed_json: input.parsed,
    normalized_json: input.normalized ?? null,
    source_file_url: input.sourceUrl ?? null,
    created_at: new Date().toISOString(),
  };

  if (!supabase) {
    await loadLocalEventState();
    if (!existingEvent) {
      memory.events.push(event);
    } else {
      Object.assign(existingEvent, event);
    }
    memory.versions.push(versionRecord);
    const targetEvent = memory.events.find((item) => item.id === eventId)!;
    targetEvent.current_version_id = versionRecord.id;
    await persistLocalEventState();
    return { event: targetEvent, version: versionRecord };
  }

  const { error: upsertEventError } = await supabase.from("events").upsert({
    id: event.id,
    property_id: event.property_id,
    event_name: event.event_name,
    client_name: event.client_name,
    event_date: event.event_date,
    room_name: event.room_name,
    event_type: event.event_type,
    status: event.status,
    current_version_id: event.current_version_id,
  });
  if (upsertEventError) {
    throw new Error(formatSupabaseWriteError("events", "upsert", upsertEventError.message));
  }

  const { error: insertVersionError } = await supabase.from("event_versions").insert({
    id: versionRecord.id,
    event_id: versionRecord.event_id,
    version_number: versionRecord.version_number,
    raw_text: versionRecord.raw_text,
    parsed_json: versionRecord.parsed_json,
    normalized_json: versionRecord.normalized_json ?? null,
    source_file_url: versionRecord.source_file_url,
  });
  if (insertVersionError) {
    throw new Error(formatSupabaseWriteError("event_versions", "insert", insertVersionError.message));
  }

  const { error: updateCurrentVersionError } = await supabase
    .from("events")
    .update({ current_version_id: versionRecord.id })
    .eq("id", event.id);
  if (updateCurrentVersionError) {
    throw new Error(formatSupabaseWriteError("events", "update", updateCurrentVersionError.message));
  }
  return { event, version: versionRecord };
}

export async function replaceTasks(eventId: string, tasks: EventTaskRecord[]) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    await loadLocalEventState();
    memory.tasks = memory.tasks.filter((task) => task.event_id !== eventId).concat(tasks);
    await persistLocalEventState();
    return tasks;
  }
  await supabase.from("event_tasks").delete().eq("event_id", eventId);
  if (tasks.length > 0) {
    await supabase.from("event_tasks").insert(tasks);
  }
  return tasks;
}

export async function createAlerts(alerts: AlertRecord[]) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    await loadLocalEventState();
    memory.alerts.push(...alerts);
    await persistLocalEventState();
    return alerts;
  }
  if (alerts.length > 0) {
    await supabase.from("alerts").insert(alerts);
  }
  return alerts;
}

export async function updateAlert(
  alertId: string,
  patch: Partial<
    Pick<
      AlertRecord,
      | "resolved"
      | "state"
      | "owner_employee_id"
      | "owner_department"
      | "acknowledged_at"
      | "acknowledged_by"
      | "resolved_at"
      | "resolved_by"
      | "escalation_level"
      | "due_at"
    >
  >,
): Promise<AlertRecord | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    await loadLocalEventState();
    const alert = memory.alerts.find((a) => a.id === alertId);
    if (!alert) return null;
    Object.assign(alert, patch);
    await persistLocalEventState();
    return alert;
  }
  const { data, error } = await supabase.from("alerts").update(patch).eq("id", alertId).select("*").maybeSingle();
  if (error) throw new Error(error.message);
  return (data as AlertRecord | null) ?? null;
}

export async function listEventConfirmations(eventId: string): Promise<EventConfirmationRecord[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    await loadLocalEventState();
    return memory.confirmations.filter((row) => row.event_id === eventId);
  }
  const { data, error } = await supabase
    .from("event_confirmations")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as EventConfirmationRecord[];
}

export async function upsertEventConfirmation(
  input: Omit<EventConfirmationRecord, "id" | "created_at">,
): Promise<EventConfirmationRecord> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    await loadLocalEventState();
    const existing = memory.confirmations.find(
      (row) =>
        row.event_id === input.event_id &&
        row.version_id === input.version_id &&
        row.department === input.department &&
        row.scope === input.scope,
    );
    if (existing) {
      Object.assign(existing, input);
      await persistLocalEventState();
      return existing;
    }
    const record: EventConfirmationRecord = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      ...input,
    };
    memory.confirmations.push(record);
    await persistLocalEventState();
    return record;
  }
  const { data, error } = await supabase
    .from("event_confirmations")
    .upsert(
      {
        id: crypto.randomUUID(),
        ...input,
      },
      { onConflict: "event_id,version_id,department,scope" },
    )
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as EventConfirmationRecord;
}
