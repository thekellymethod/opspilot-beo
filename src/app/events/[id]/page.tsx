"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type EventPayload = {
  event: { id: string; event_name: string; room_name: string; event_date: string; event_type: string };
  parsed: {
    timeline: Array<{ time: string; label: string }>;
    guest_count: number;
    service_style: string;
    staffing?: { servers_required: number; bartenders_required: number; kitchen_required: number };
    menu: Array<{ course: string; item: string; count: number }>;
    dietary_notes: string[];
    equipment: string[];
  };
  tasks: Array<{
    id: string;
    department: string;
    title: string;
    checklist: string[];
    checklist_done?: boolean[];
    status: string;
  }>;
  alerts: Array<{ id: string; severity: string; message: string }>;
  availableStaff?: Array<{ id: string; staff_name: string; department: "kitchen" | "banquets" | "bar"; role: string | null }>;
  assignedStaff?: Array<{
    assignmentId: string;
    staffRosterId: string;
    staff_name: string;
    department: "kitchen" | "banquets" | "bar";
    role: string | null;
    shift_date: string;
    assigned_at: string;
  }>;
  latestChangeView?: { id: string; title: string; summary: string; created_at: string } | null;
  staffingCapacity?: { servers: number; bartenders: number; kitchen: number };
  confirmations?: Array<{
    id: string;
    department: string;
    scope: "briefing" | "ops_plan" | "final_signoff";
    required: boolean;
    acknowledged: boolean;
    acknowledged_at: string | null;
    acknowledged_by: string | null;
  }>;
};

function normalizeEventPayload(payload: EventPayload): EventPayload {
  return {
    ...payload,
    event: {
      id: payload.event?.id ?? "",
      event_name: payload.event?.event_name ?? "Untitled event",
      room_name: payload.event?.room_name ?? "TBD",
      event_date: payload.event?.event_date ?? "TBD",
      event_type: payload.event?.event_type ?? "Unknown",
    },
    parsed: {
      timeline: payload.parsed?.timeline ?? [],
      guest_count: payload.parsed?.guest_count ?? 0,
      service_style: payload.parsed?.service_style ?? "unknown",
      staffing: {
        servers_required: payload.parsed?.staffing?.servers_required ?? 0,
        bartenders_required: payload.parsed?.staffing?.bartenders_required ?? 0,
        kitchen_required: payload.parsed?.staffing?.kitchen_required ?? 0,
      },
      menu: payload.parsed?.menu ?? [],
      dietary_notes: payload.parsed?.dietary_notes ?? [],
      equipment: payload.parsed?.equipment ?? [],
    },
    tasks: payload.tasks ?? [],
    alerts: payload.alerts ?? [],
    availableStaff: payload.availableStaff ?? [],
    assignedStaff: payload.assignedStaff ?? [],
    latestChangeView: payload.latestChangeView ?? null,
    staffingCapacity: payload.staffingCapacity ?? { servers: 0, bartenders: 0, kitchen: 0 },
    confirmations: payload.confirmations ?? [],
  };
}

const tabs = ["Overview", "Tasks & Ownership", "Notifications", "Inputs", "Confirmations"] as const;

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [eventId, setEventId] = useState<string>("");
  const [tab, setTab] = useState<(typeof tabs)[number]>("Overview");
  const [data, setData] = useState<EventPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<null | "tasks" | "changes">(null);
  const [savingChangeView, setSavingChangeView] = useState(false);
  const [changeViewTitle, setChangeViewTitle] = useState("Final operational changes");
  const [changeViewSummary, setChangeViewSummary] = useState("");
  const [signoffMessage, setSignoffMessage] = useState<string | null>(null);

  useEffect(() => {
    params.then(({ id }) => setEventId(id));
  }, [params]);

  async function loadEventDetails(id: string) {
    setLoadError(null);
    const response = await fetch(`/api/events/${id}`);
    const json = (await response.json().catch(() => ({}))) as EventPayload & { error?: string };
    if (!response.ok) {
      throw new Error(json.error ?? `Failed to load event (${response.status})`);
    }
    setData(normalizeEventPayload(json as EventPayload));
  }

  useEffect(() => {
    if (!eventId) return;
    loadEventDetails(eventId)
      .catch((error: unknown) => {
        setData(null);
        setLoadError(error instanceof Error ? error.message : "Failed to load event.");
      });
  }, [eventId]);

  useEffect(() => {
    if (!data || changeViewSummary.trim()) return;
    if (data.alerts.length === 0) return;
    const suggested = data.alerts.map((alert) => `- [${alert.severity}] ${alert.message}`).join("\n");
    setChangeViewSummary(suggested);
  }, [data, changeViewSummary]);

  const tasksByDepartment = useMemo(() => {
    if (!data) return {};
    return (data.tasks ?? []).reduce<Record<string, EventPayload["tasks"]>>((acc, task) => {
      acc[task.department] = [...(acc[task.department] ?? []), task];
      return acc;
    }, {});
  }, [data]);

  const menuPortions = useMemo(() => {
    if (!data) return 0;
    return data.parsed.menu.reduce((sum, item) => sum + (Number.isFinite(item.count) ? item.count : 0), 0);
  }, [data]);

  const staffingGaps = useMemo(() => {
    if (!data) return [];
    const gaps: string[] = [];
    const serversGap = (data.parsed.staffing?.servers_required ?? 0) - (data.staffingCapacity?.servers ?? 0);
    const bartendersGap = (data.parsed.staffing?.bartenders_required ?? 0) - (data.staffingCapacity?.bartenders ?? 0);
    const kitchenGap = (data.parsed.staffing?.kitchen_required ?? 0) - (data.staffingCapacity?.kitchen ?? 0);
    if (serversGap > 0) gaps.push(`Servers -${serversGap}`);
    if (bartendersGap > 0) gaps.push(`Bartenders -${bartendersGap}`);
    if (kitchenGap > 0) gaps.push(`Kitchen -${kitchenGap}`);
    return gaps;
  }, [data]);

  const staffByDepartment = useMemo(() => {
    if (!data?.availableStaff) return { banquets: [], bar: [], kitchen: [] } as Record<string, Array<{ id: string; staff_name: string; role: string | null }>>;
    return data.availableStaff.reduce<Record<string, Array<{ id: string; staff_name: string; role: string | null }>>>(
      (acc, row) => {
        acc[row.department] = [...(acc[row.department] ?? []), { id: row.id, staff_name: row.staff_name, role: row.role }];
        return acc;
      },
      { banquets: [], bar: [], kitchen: [] },
    );
  }, [data]);

  async function runEventAction(path: string, mode: "tasks" | "changes") {
    setActionError(null);
    setActionLoading(mode);
    try {
      const response = await fetch(path, { method: "POST" });
      const json = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
      if (!response.ok) {
        throw new Error(json.details ? `${json.error ?? "Request failed"}: ${json.details}` : (json.error ?? `Request failed (${response.status})`));
      }
      location.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Action failed.");
      setActionLoading(null);
    }
  }

  async function assignStaff(staffRosterId: string) {
    if (!data) return;
    setActionError(null);
    try {
      const response = await fetch(`/api/events/${data.event.id}/staff-assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffRosterId }),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
      if (!response.ok) {
        throw new Error(json.details ? `${json.error ?? "Failed"}: ${json.details}` : (json.error ?? "Failed"));
      }
      await loadEventDetails(data.event.id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to assign staff.");
    }
  }

  async function removeAssignedStaff(staffRosterId: string) {
    if (!data) return;
    setActionError(null);
    try {
      const response = await fetch(`/api/events/${data.event.id}/staff-assignments`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffRosterId }),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
      if (!response.ok) {
        throw new Error(json.details ? `${json.error ?? "Failed"}: ${json.details}` : (json.error ?? "Failed"));
      }
      await loadEventDetails(data.event.id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to remove assignment.");
    }
  }

  async function saveFinalChangeView() {
    if (!data) return;
    if (!changeViewTitle.trim() || !changeViewSummary.trim()) {
      setActionError("Provide both title and summary before saving final view.");
      return;
    }
    setSavingChangeView(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/events/${data.event.id}/change-view`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: changeViewTitle.trim(),
          summary: changeViewSummary.trim(),
        }),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
      if (!response.ok) {
        throw new Error(json.details ? `${json.error ?? "Failed"}: ${json.details}` : (json.error ?? "Failed"));
      }
      await loadEventDetails(data.event.id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to save final change view.");
    } finally {
      setSavingChangeView(false);
    }
  }

  async function setTaskStatus(taskId: string, status: "pending" | "acknowledged" | "blocked" | "complete") {
    if (!data) return;
    setActionError(null);
    const response = await fetch(`/api/events/${data.event.id}/tasks/${taskId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, actor: "ops-user" }),
    });
    const json = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setActionError(json.error ?? "Failed to update task.");
      return;
    }
    await loadEventDetails(data.event.id);
  }

  async function toggleChecklistLine(taskId: string, index: number, done: boolean) {
    if (!data) return;
    setActionError(null);
    const response = await fetch(`/api/events/${data.event.id}/tasks/${taskId}/checklist`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ index, done }),
    });
    const json = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setActionError(json.error ?? "Failed to update checklist line.");
      return;
    }
    await loadEventDetails(data.event.id);
  }

  async function acknowledgeNotification(notificationId: string, state: "acknowledged" | "resolved" | "escalated") {
    if (!data) return;
    setActionError(null);
    const response = await fetch(`/api/events/${data.event.id}/notifications/${notificationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state, actor: "ops-user" }),
    });
    const json = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setActionError(json.error ?? "Failed to update notification.");
      return;
    }
    await loadEventDetails(data.event.id);
  }

  async function saveConfirmation(department: string, acknowledged: boolean) {
    if (!data) return;
    setActionError(null);
    const response = await fetch(`/api/events/${data.event.id}/confirmations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        department,
        scope: "final_signoff",
        acknowledged,
        acknowledgedBy: "ops-user",
      }),
    });
    const json = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setActionError(json.error ?? "Failed to save confirmation.");
      return;
    }
    await loadEventDetails(data.event.id);
  }

  async function runFinalSignoff() {
    if (!data) return;
    setSignoffMessage(null);
    setActionError(null);
    const response = await fetch(`/api/events/${data.event.id}/final-signoff`, { method: "POST" });
    const json = (await response.json().catch(() => ({}))) as { error?: string; unmetRequirements?: string[] };
    if (!response.ok) {
      const unmet = json.unmetRequirements?.length ? ` Missing: ${json.unmetRequirements.join(", ")}.` : "";
      setSignoffMessage(`${json.error ?? "Final sign-off failed."}${unmet}`);
      return;
    }
    setSignoffMessage("Final sign-off complete. Event is operationally confirmed.");
  }

  if (loadError) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-6 py-24">
        <div className="max-w-xl rounded-2xl border border-red-500/30 bg-red-950/35 p-6 text-sm text-red-100/95">
          <p className="font-semibold text-red-200">Could not load event details.</p>
          <p className="mt-2">{loadError}</p>
          <p className="mt-3 text-red-100/80">
            This usually means the event was created but its version was not saved. Re-run the intake or promote step.
          </p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-6 py-24 text-brand-muted">
        <p className="font-display text-lg text-brand-champagne/80">Loading event…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-5 py-10 sm:px-8">
      <header className="relative overflow-hidden rounded-3xl border border-brand-border bg-gradient-to-br from-brand-surface/90 to-brand-navy/80 p-8">
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-brand-gold/10 blur-2xl"
          aria-hidden
        />
        <div className="relative">
          <Link href="/dashboard/events" className="text-xs font-medium text-brand-gold-bright hover:underline">
            ← Events dashboard
          </Link>
          <h1 className="font-display mt-3 text-2xl font-semibold text-brand-champagne sm:text-3xl">{data.event.event_name}</h1>
          <p className="mt-2 text-sm text-brand-muted">
            {data.event.event_date} · {data.event.room_name} · {data.event.event_type}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-white/15 bg-brand-night/40 px-3 py-1 text-xs text-brand-muted">
              Guest count: {data.parsed.guest_count || "TBD"}
            </span>
            <span className="rounded-full border border-white/15 bg-brand-night/40 px-3 py-1 text-xs text-brand-muted">
              Service: {data.parsed.service_style}
            </span>
            <span className="rounded-full border border-white/15 bg-brand-night/40 px-3 py-1 text-xs text-brand-muted">
              Assigned staff: {data.assignedStaff?.length ?? 0}
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-xs ${
                staffingGaps.length > 0
                  ? "border-red-400/40 bg-red-900/20 text-red-200"
                  : "border-emerald-400/40 bg-emerald-900/20 text-emerald-200"
              }`}
            >
              {staffingGaps.length > 0 ? `Staffing gaps: ${staffingGaps.join(", ")}` : "Staffing coverage: OK"}
            </span>
          </div>
        </div>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition ${
              tab === item
                ? "border border-brand-gold/45 bg-brand-gold/20 text-brand-champagne shadow-[0_0_20px_-8px_rgba(201,168,76,0.35)]"
                : "border border-transparent bg-brand-surface/50 text-brand-muted hover:border-brand-border hover:text-brand-champagne"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <section className="rounded-2xl border border-brand-border/80 bg-brand-surface/50 p-6 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.45)] sm:p-8">
        {tab === "Overview" && (
          <div className="grid gap-4 text-sm text-brand-champagne/90 lg:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-brand-night/35 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold-dim">Event Snapshot</p>
              <div className="mt-2 space-y-1">
                <p>
                  <span className="text-brand-muted">Guest count</span>{" "}
                  <span className="font-semibold text-brand-champagne">{data.parsed.guest_count || "TBD"}</span>
                </p>
                <p>
                  <span className="text-brand-muted">Service</span>{" "}
                  <span className="capitalize">{data.parsed.service_style}</span>
                </p>
                <p>
                  <span className="text-brand-muted">Assigned staff</span>{" "}
                  <span>{data.assignedStaff?.length ?? 0}</span>
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-brand-night/35 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold-dim">Timeline</p>
              <ul className="mt-2 space-y-2">
                {data.parsed.timeline.length === 0 ? (
                  <li className="text-brand-muted">No timeline extracted.</li>
                ) : (
                  data.parsed.timeline.map((line) => (
                    <li key={`${line.time}-${line.label}`} className="flex gap-3 text-brand-muted">
                      <span className="font-mono text-xs text-brand-gold-dim">{line.time}</span>
                      <span className="text-brand-champagne/90">{line.label}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div className="rounded-xl border border-white/10 bg-brand-night/35 p-4 lg:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold-dim">Staffing Coverage</p>
              <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
                <div className="rounded-lg border border-white/10 bg-brand-night/40 p-2">
                  <p className="text-brand-muted">Servers</p>
                  <p>
                    Required {data.parsed.staffing?.servers_required ?? 0} / Available {data.staffingCapacity?.servers ?? 0}
                  </p>
                  {staffByDepartment.banquets.length > 0 ? (
                    <p className="mt-1 text-xs text-brand-muted">
                      {staffByDepartment.banquets.map((s) => (s.role ? `${s.staff_name} (${s.role})` : s.staff_name)).join(", ")}
                    </p>
                  ) : null}
                </div>
                <div className="rounded-lg border border-white/10 bg-brand-night/40 p-2">
                  <p className="text-brand-muted">Bartenders</p>
                  <p>
                    Required {data.parsed.staffing?.bartenders_required ?? 0} / Available {data.staffingCapacity?.bartenders ?? 0}
                  </p>
                  {staffByDepartment.bar.length > 0 ? (
                    <p className="mt-1 text-xs text-brand-muted">
                      {staffByDepartment.bar.map((s) => (s.role ? `${s.staff_name} (${s.role})` : s.staff_name)).join(", ")}
                    </p>
                  ) : null}
                </div>
                <div className="rounded-lg border border-white/10 bg-brand-night/40 p-2">
                  <p className="text-brand-muted">Kitchen</p>
                  <p>
                    Required {data.parsed.staffing?.kitchen_required ?? 0} / Available {data.staffingCapacity?.kitchen ?? 0}
                  </p>
                  {staffByDepartment.kitchen.length > 0 ? (
                    <p className="mt-1 text-xs text-brand-muted">
                      {staffByDepartment.kitchen.map((s) => (s.role ? `${s.staff_name} (${s.role})` : s.staff_name)).join(", ")}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-brand-night/35 p-4 lg:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold-dim">Assigned To This Event</p>
              {data.assignedStaff && data.assignedStaff.length > 0 ? (
                <ul className="mt-2 space-y-2">
                  {data.assignedStaff.map((staff) => (
                    <li key={staff.assignmentId} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-brand-night/40 p-2">
                      <span className="text-sm">
                        {staff.staff_name} · <span className="capitalize text-brand-muted">{staff.department}</span>{" "}
                        {staff.role ? `(${staff.role})` : ""}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAssignedStaff(staff.staffRosterId)}
                        className="rounded border border-red-400/40 px-2 py-1 text-xs text-red-200 hover:bg-red-900/30"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-brand-muted">No staff assigned yet.</p>
              )}
              {data.availableStaff && data.availableStaff.length > 0 ? (
                <div className="mt-3">
                  <p className="text-xs text-brand-muted">Available staff for event date</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {data.availableStaff.map((staff) => {
                      const alreadyAssigned = Boolean(data.assignedStaff?.some((a) => a.staffRosterId === staff.id));
                      return (
                        <button
                          key={staff.id}
                          type="button"
                          disabled={alreadyAssigned}
                          onClick={() => assignStaff(staff.id)}
                          className="rounded border border-white/15 px-2 py-1 text-xs text-brand-champagne hover:bg-white/5 disabled:opacity-40"
                        >
                          {staff.staff_name} ({staff.department})
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {tab === "Tasks & Ownership" && (
          <div className="space-y-6">
            <p className="text-xs uppercase tracking-wide text-brand-muted">Department task boards</p>
            {Object.keys(tasksByDepartment).length === 0 ? (
              <p className="text-sm text-brand-muted">No tasks yet. Click <strong>Generate tasks</strong> below.</p>
            ) : null}
            {Object.entries(tasksByDepartment).map(([department, tasks]) => (
              <div key={department} className="rounded-xl border border-white/10 bg-brand-night/30 p-4">
                <h2 className="font-display text-base font-semibold capitalize text-brand-gold-bright">{department}</h2>
                <ul className="mt-2 space-y-2 text-sm">
                  {tasks.map((task) => (
                    <li key={task.id} className="rounded-xl border border-white/10 bg-brand-night/40 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-brand-champagne">{task.title}</p>
                        <span className="text-xs text-brand-muted">Status: {task.status}</span>
                      </div>
                      <ul className="mt-2 space-y-1.5 border-t border-white/5 pt-2">
                        {task.checklist.map((line, idx) => {
                          const checked = Boolean(task.checklist_done?.[idx]);
                          return (
                            <li key={`${task.id}-${idx}`} className="flex items-start gap-2 text-xs text-brand-muted">
                              <input
                                type="checkbox"
                                className="mt-0.5 shrink-0"
                                checked={checked}
                                onChange={(e) => void toggleChecklistLine(task.id, idx, e.target.checked)}
                                aria-label={`Checklist item ${idx + 1} for ${task.title}`}
                              />
                              <span className={checked ? "text-brand-champagne/55 line-through" : ""}>{line}</span>
                            </li>
                          );
                        })}
                      </ul>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setTaskStatus(task.id, "acknowledged")}
                          className="rounded border border-amber-400/40 px-2 py-1 text-xs text-amber-100 hover:bg-amber-900/30"
                        >
                          Acknowledge
                        </button>
                        <button
                          type="button"
                          onClick={() => setTaskStatus(task.id, "blocked")}
                          className="rounded border border-red-400/40 px-2 py-1 text-xs text-red-100 hover:bg-red-900/30"
                        >
                          Block
                        </button>
                        <button
                          type="button"
                          onClick={() => setTaskStatus(task.id, "complete")}
                          className="rounded border border-emerald-400/40 px-2 py-1 text-xs text-emerald-100 hover:bg-emerald-900/30"
                        >
                          Complete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {tab === "Notifications" && (
          <div className="space-y-4 text-sm text-brand-champagne/90">
            <p className="text-xs uppercase tracking-wide text-brand-muted">Operational alerts and lifecycle actions</p>
            <ul className="space-y-3">
              {data.alerts.length === 0 && <li className="text-brand-muted">No notifications.</li>}
              {data.alerts.map((alert) => (
                <li key={alert.id} className="rounded-xl border border-brand-burgundy/30 bg-brand-burgundy/10 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-brand-burgundy-glow">{alert.severity}</p>
                  <p className="mt-1 text-brand-champagne/90">{alert.message}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => acknowledgeNotification(alert.id, "acknowledged")}
                      className="rounded border border-amber-400/40 px-2 py-1 text-xs text-amber-100 hover:bg-amber-900/30"
                    >
                      Acknowledge
                    </button>
                    <button
                      type="button"
                      onClick={() => acknowledgeNotification(alert.id, "escalated")}
                      className="rounded border border-red-400/40 px-2 py-1 text-xs text-red-100 hover:bg-red-900/30"
                    >
                      Escalate
                    </button>
                    <button
                      type="button"
                      onClick={() => acknowledgeNotification(alert.id, "resolved")}
                      className="rounded border border-emerald-400/40 px-2 py-1 text-xs text-emerald-100 hover:bg-emerald-900/30"
                    >
                      Resolve
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === "Inputs" && (
          <div className="space-y-4 text-sm">
            <p className="text-xs uppercase tracking-wide text-brand-muted">Structured operational inputs</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-brand-night/30 p-3">
                <p className="text-brand-muted">Menu dishes</p>
                <p className="font-semibold">{data.parsed.menu.length}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-brand-night/30 p-3">
                <p className="text-brand-muted">Total portions</p>
                <p className="font-semibold">{menuPortions}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-brand-night/30 p-3">
                <p className="text-brand-muted">Equipment rows</p>
                <p className="font-semibold">{data.parsed.equipment.length}</p>
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-brand-night/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold-dim">Save Clean Final View Of Changes</p>
              <input
                value={changeViewTitle}
                onChange={(e) => setChangeViewTitle(e.target.value)}
                className="mt-2 w-full rounded border border-white/15 bg-brand-night/40 px-3 py-2 text-sm text-brand-champagne"
                placeholder="Final view title"
              />
              <textarea
                value={changeViewSummary}
                onChange={(e) => setChangeViewSummary(e.target.value)}
                rows={6}
                className="mt-2 w-full rounded border border-white/15 bg-brand-night/40 px-3 py-2 text-sm text-brand-champagne"
                placeholder="Summarize final approved operational changes"
              />
              <button
                type="button"
                disabled={savingChangeView}
                onClick={saveFinalChangeView}
                className="mt-2 rounded border border-brand-gold/40 bg-brand-gold/15 px-3 py-2 text-xs font-semibold text-brand-gold-bright transition hover:bg-brand-gold/25 disabled:opacity-50"
              >
                {savingChangeView ? "Saving…" : "Save final view"}
              </button>
              {data.latestChangeView ? (
                <div className="mt-3 rounded border border-white/10 bg-brand-night/30 p-3">
                  <p className="text-xs text-brand-muted">Latest saved view</p>
                  <p className="mt-1 font-semibold text-brand-champagne">{data.latestChangeView.title}</p>
                  <pre className="mt-2 whitespace-pre-wrap text-xs text-brand-champagne/90">{data.latestChangeView.summary}</pre>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {tab === "Confirmations" && (
          <div className="space-y-4 text-sm">
            <p className="text-xs uppercase tracking-wide text-brand-muted">Manager + all department confirmations</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {["management", "banquets", "kitchen", "bar", "engineering", "housekeeping", "security", "front_office"].map(
                (department) => {
                  const existing = data.confirmations?.find(
                    (row) => row.department === department && row.scope === "final_signoff" && row.acknowledged,
                  );
                  return (
                    <div key={department} className="flex items-center justify-between rounded border border-white/10 bg-brand-night/30 px-3 py-2">
                      <span className="capitalize text-brand-champagne">{department.replace("_", " ")}</span>
                      <button
                        type="button"
                        onClick={() => saveConfirmation(department, !Boolean(existing))}
                        className={`rounded px-2 py-1 text-xs ${
                          existing
                            ? "border border-emerald-400/40 bg-emerald-900/20 text-emerald-100"
                            : "border border-white/20 bg-white/5 text-brand-champagne"
                        }`}
                      >
                        {existing ? "Confirmed" : "Confirm"}
                      </button>
                    </div>
                  );
                },
              )}
            </div>
            <button
              type="button"
              onClick={runFinalSignoff}
              className="rounded-xl border border-brand-gold/40 bg-brand-gold/12 px-4 py-2 text-sm font-semibold text-brand-gold-bright hover:bg-brand-gold/22"
            >
              Run final sign-off check
            </button>
            {signoffMessage ? <p className="text-xs text-brand-muted">{signoffMessage}</p> : null}
          </div>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={actionLoading !== null}
          className="rounded-xl border border-white/12 bg-brand-surface/60 px-4 py-2.5 text-sm text-brand-champagne transition hover:border-brand-border hover:bg-white/5"
          onClick={() => runEventAction(`/api/events/${data.event.id}/generate-tasks`, "tasks")}
        >
          {actionLoading === "tasks" ? "Generating tasks…" : "Generate tasks"}
        </button>
        <button
          type="button"
          disabled={actionLoading !== null}
          className="rounded-xl border border-white/12 bg-brand-surface/60 px-4 py-2.5 text-sm text-brand-champagne transition hover:border-brand-border hover:bg-white/5"
          onClick={() => runEventAction(`/api/events/${data.event.id}/detect-changes`, "changes")}
        >
          {actionLoading === "changes" ? "Detecting changes…" : "Detect changes"}
        </button>
        <Link
          href={`/events/${data.event.id}/briefing`}
          className="rounded-xl border border-brand-gold/45 bg-brand-gold/18 px-4 py-2.5 text-sm font-semibold text-brand-champagne shadow-[0_0_24px_-8px_rgba(201,168,76,0.35)] transition hover:bg-brand-gold/28"
        >
          Open briefing
        </Link>
        <Link
          href={`/dashboard/events/${data.event.id}/briefing`}
          className="rounded-xl border border-brand-border px-4 py-2.5 text-sm text-brand-gold-bright transition hover:bg-white/5"
        >
          Server briefing
        </Link>
      </div>
      {actionError ? (
        <p className="text-sm text-red-200">{actionError}</p>
      ) : null}
    </main>
  );
}
