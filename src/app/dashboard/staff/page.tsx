"use client";

import { useEffect, useMemo, useState } from "react";

type StaffRow = {
  id: string;
  property_id: string | null;
  staff_name: string;
  department: "banquets" | "bar" | "kitchen";
  role: string | null;
  shift_date: string;
  available: boolean;
};

type RosterResponse = {
  date: string;
  staff: StaffRow[];
};

const departments: Array<StaffRow["department"]> = ["banquets", "bar", "kitchen"];

function startOfWeekMonday(dateIso: string): string {
  const d = new Date(`${dateIso}T12:00:00`);
  const day = d.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function addDays(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function DashboardStaffPage() {
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [weekRows, setWeekRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [staffName, setStaffName] = useState("");
  const [department, setDepartment] = useState<StaffRow["department"]>("banquets");
  const [role, setRole] = useState("");
  const [available, setAvailable] = useState(true);
  const [saving, setSaving] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importing, setImporting] = useState(false);
  const [deptFilter, setDeptFilter] = useState<"all" | StaffRow["department"]>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [weeksToShow, setWeeksToShow] = useState<number>(2);
  const [copyingWeek, setCopyingWeek] = useState(false);
  const [selectedStaffKeys, setSelectedStaffKeys] = useState<Set<string>>(new Set());
  const [rangeStart, setRangeStart] = useState<string>(new Date().toISOString().slice(0, 10));
  const [rangeEnd, setRangeEnd] = useState<string>(addDays(new Date().toISOString().slice(0, 10), 6));
  const [bulkAvailable, setBulkAvailable] = useState(true);
  const [bulkApplying, setBulkApplying] = useState(false);

  async function loadRoster(targetDate: string) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/staff/roster?date=${targetDate}`);
      const json = (await response.json().catch(() => ({}))) as RosterResponse & { error?: string };
      if (!response.ok) {
        throw new Error(json.error ?? `Failed to load roster (${response.status})`);
      }
      setRows(Array.isArray(json.staff) ? json.staff : []);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "Failed to load roster.");
    } finally {
      setLoading(false);
    }
  }

  async function loadWeek(targetDate: string) {
    setWeeklyLoading(true);
    try {
      const monday = startOfWeekMonday(targetDate);
      const dates = Array.from({ length: weeksToShow * 7 }, (_, idx) => addDays(monday, idx));
      const responses = await Promise.all(
        dates.map(async (d) => {
          const response = await fetch(`/api/staff/roster?date=${d}&include_unavailable=1`);
          const json = (await response.json().catch(() => ({}))) as RosterResponse & { error?: string };
          if (!response.ok) {
            throw new Error(json.error ?? `Failed to load roster for ${d}`);
          }
          return Array.isArray(json.staff) ? json.staff : [];
        }),
      );
      setWeekRows(responses.flat());
    } catch (e) {
      setWeekRows([]);
      setError(e instanceof Error ? e.message : "Failed to load weekly roster.");
    } finally {
      setWeeklyLoading(false);
    }
  }

  useEffect(() => {
    loadRoster(date);
    loadWeek(date);
  }, [date, weeksToShow]);

  async function addRosterEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!staffName.trim()) {
      setError("Staff name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/staff/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: [
            {
              property_id: null,
              staff_name: staffName.trim(),
              department,
              role: role.trim() || null,
              shift_date: date,
              available,
            },
          ],
        }),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
      if (!response.ok) {
        throw new Error(json.details ? `${json.error ?? "Save failed"}: ${json.details}` : (json.error ?? "Save failed"));
      }
      setStaffName("");
      setRole("");
      setAvailable(true);
      await loadRoster(date);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save roster entry.");
    } finally {
      setSaving(false);
    }
  }

  async function setRowAvailability(id: string, next: boolean) {
    setError(null);
    try {
      const response = await fetch("/api/staff/roster", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, available: next }),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Failed to update availability.");
      await loadRoster(date);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update availability.");
    }
  }

  async function deleteRow(id: string) {
    setError(null);
    try {
      const response = await fetch("/api/staff/roster", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Failed to delete row.");
      await loadRoster(date);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete row.");
    }
  }

  async function importCsv() {
    setImporting(true);
    setError(null);
    try {
      const lines = csvText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      if (lines.length < 2) {
        throw new Error("CSV needs header + at least one row.");
      }
      const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const idxName = header.indexOf("name");
      const idxDept = header.indexOf("department");
      const idxRole = header.indexOf("role");
      const idxShiftDate = header.indexOf("shift_date");
      const idxAvailable = header.indexOf("available");
      if (idxName < 0 || idxDept < 0 || idxShiftDate < 0) {
        throw new Error("CSV header must include name,department,shift_date (optional: role,available).");
      }

      const entries = lines.slice(1).map((line) => {
        const cols = line.split(",").map((c) => c.trim());
        const dept = cols[idxDept] as StaffRow["department"];
        return {
          property_id: null,
          staff_name: cols[idxName] ?? "",
          department: dept,
          role: idxRole >= 0 ? (cols[idxRole] || null) : null,
          shift_date: cols[idxShiftDate] || date,
          available: idxAvailable >= 0 ? (cols[idxAvailable] ?? "true").toLowerCase() !== "false" : true,
        };
      });

      const response = await fetch("/api/staff/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
      if (!response.ok) {
        throw new Error(json.details ? `${json.error ?? "Import failed"}: ${json.details}` : (json.error ?? "Import failed"));
      }
      setCsvText("");
      await loadRoster(date);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to import CSV.");
    } finally {
      setImporting(false);
    }
  }

  const counts = useMemo(() => {
    return departments.reduce<Record<StaffRow["department"], number>>(
      (acc, d) => {
        acc[d] = rows.filter((r) => r.department === d && r.available).length;
        return acc;
      },
      { banquets: 0, bar: 0, kitchen: 0 },
    );
  }, [rows]);

  const weekDates = useMemo(() => {
    const monday = startOfWeekMonday(date);
    return Array.from({ length: weeksToShow * 7 }, (_, idx) => addDays(monday, idx));
  }, [date, weeksToShow]);

  const weeklyStaffIndex = useMemo(() => {
    const index = new Map<string, { staff_name: string; department: StaffRow["department"]; role: string | null }>();
    for (const row of weekRows) {
      const key = `${row.staff_name.toLowerCase()}|${row.department}|${(row.role ?? "").toLowerCase()}`;
      if (!index.has(key)) {
        index.set(key, { staff_name: row.staff_name, department: row.department, role: row.role });
      }
    }
    for (const row of rows) {
      const key = `${row.staff_name.toLowerCase()}|${row.department}|${(row.role ?? "").toLowerCase()}`;
      if (!index.has(key)) {
        index.set(key, { staff_name: row.staff_name, department: row.department, role: row.role });
      }
    }
    return Array.from(index.entries())
      .map(([key, meta]) => ({ key, ...meta }))
      .sort((a, b) => {
        if (a.department !== b.department) return a.department.localeCompare(b.department);
        return a.staff_name.localeCompare(b.staff_name);
      });
  }, [weekRows, rows]);

  const filteredWeeklyStaff = useMemo(() => {
    return weeklyStaffIndex.filter((row) => {
      if (deptFilter !== "all" && row.department !== deptFilter) return false;
      if (roleFilter !== "all" && (row.role ?? "Unassigned") !== roleFilter) return false;
      return true;
    });
  }, [weeklyStaffIndex, deptFilter, roleFilter]);

  const availableRoles = useMemo(() => {
    const roles = new Set<string>();
    for (const row of weeklyStaffIndex) {
      roles.add(row.role ?? "Unassigned");
    }
    return Array.from(roles).sort((a, b) => a.localeCompare(b));
  }, [weeklyStaffIndex]);

  function findWeeklyRow(staffKey: string, shiftDate: string): StaffRow | undefined {
    return weekRows.find((row) => `${row.staff_name.toLowerCase()}|${row.department}|${(row.role ?? "").toLowerCase()}` === staffKey && row.shift_date === shiftDate);
  }

  async function upsertWeeklyAvailability(
    meta: { key: string; staff_name: string; department: StaffRow["department"]; role: string | null },
    shiftDate: string,
    nextAvailable: boolean,
  ) {
    const existing = findWeeklyRow(meta.key, shiftDate);

    if (existing) {
      const response = await fetch("/api/staff/roster", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: existing.id, available: nextAvailable }),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Failed to update weekly availability.");
    } else if (nextAvailable) {
      const response = await fetch("/api/staff/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: [
            {
              property_id: null,
              staff_name: meta.staff_name,
              department: meta.department,
              role: meta.role,
              shift_date: shiftDate,
              available: true,
            },
          ],
        }),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
      if (!response.ok) throw new Error(json.details ? `${json.error ?? "Failed"}: ${json.details}` : (json.error ?? "Failed"));
    }
  }

  async function toggleWeeklyAvailability(staffKey: string, shiftDate: string, nextAvailable: boolean) {
    setError(null);
    const meta = weeklyStaffIndex.find((item) => item.key === staffKey);
    if (!meta) return;
    try {
      await upsertWeeklyAvailability(meta, shiftDate, nextAvailable);
      await Promise.all([loadRoster(date), loadWeek(date)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update weekly availability.");
    }
  }

  async function applyBulkAvailability() {
    setBulkApplying(true);
    setError(null);
    try {
      if (selectedStaffKeys.size === 0) throw new Error("Select at least one staff row.");
      const start = new Date(`${rangeStart}T12:00:00`).getTime();
      const end = new Date(`${rangeEnd}T12:00:00`).getTime();
      if (Number.isNaN(start) || Number.isNaN(end) || end < start) throw new Error("Choose a valid date range.");

      const selected = filteredWeeklyStaff.filter((s) => selectedStaffKeys.has(s.key));
      for (const staff of selected) {
        for (const d of weekDates) {
          const t = new Date(`${d}T12:00:00`).getTime();
          if (t < start || t > end) continue;
          await upsertWeeklyAvailability(staff, d, bulkAvailable);
        }
      }
      await Promise.all([loadRoster(date), loadWeek(date)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to apply bulk availability.");
    } finally {
      setBulkApplying(false);
    }
  }

  async function copyPreviousWeek() {
    setCopyingWeek(true);
    setError(null);
    try {
      const previousMonday = addDays(weekDates[0], -(weeksToShow * 7));
      const previousDates = Array.from({ length: weeksToShow * 7 }, (_, idx) => addDays(previousMonday, idx));
      const previousResponses = await Promise.all(
        previousDates.map(async (d) => {
          const response = await fetch(`/api/staff/roster?date=${d}&include_unavailable=1`);
          const json = (await response.json().catch(() => ({}))) as RosterResponse & { error?: string };
          if (!response.ok) throw new Error(json.error ?? `Failed to load previous week for ${d}`);
          return Array.isArray(json.staff) ? json.staff : [];
        }),
      );
      const previousRows = previousResponses.flat();
      const entries = previousRows.map((row) => {
        const offset = Math.round(
          (new Date(`${row.shift_date}T12:00:00`).getTime() - new Date(`${previousMonday}T12:00:00`).getTime()) / 86400000,
        );
        return {
          property_id: row.property_id,
          staff_name: row.staff_name,
          department: row.department,
          role: row.role,
          shift_date: addDays(weekDates[0], offset),
          available: row.available,
        };
      });
      if (entries.length === 0) {
        throw new Error("No previous-week entries found to copy.");
      }
      const response = await fetch("/api/staff/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
      if (!response.ok) {
        throw new Error(json.details ? `${json.error ?? "Copy failed"}: ${json.details}` : (json.error ?? "Copy failed"));
      }
      await Promise.all([loadRoster(date), loadWeek(date)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to copy previous week.");
    } finally {
      setCopyingWeek(false);
    }
  }

  return (
    <main className="relative flex-1 px-5 py-8 sm:px-8 lg:py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="rounded-3xl border border-brand-border bg-brand-surface/55 p-6 sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-brand-gold">Staff roster</p>
          <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight text-brand-champagne">Shift availability</h1>
          <p className="mt-2 text-sm text-brand-muted">
            Manage who is available by department for each service date.
          </p>
        </header>

        <section className="rounded-2xl border border-brand-border/80 bg-brand-surface/50 p-6">
          <div className="flex flex-wrap items-end gap-4">
            <label className="text-sm text-brand-muted">
              Shift date
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 block rounded-lg border border-white/15 bg-brand-night/40 px-3 py-2 text-brand-champagne"
              />
            </label>
            <div className="text-xs text-brand-muted">
              Banquets: <span className="text-brand-champagne">{counts.banquets}</span> · Bar:{" "}
              <span className="text-brand-champagne">{counts.bar}</span> · Kitchen:{" "}
              <span className="text-brand-champagne">{counts.kitchen}</span>
            </div>
            <label className="text-sm text-brand-muted">
              Weeks to show
              <select
                value={weeksToShow}
                onChange={(e) => setWeeksToShow(Number(e.target.value))}
                className="mt-1 block rounded-lg border border-white/15 bg-brand-night/40 px-3 py-2 text-brand-champagne"
              >
                <option value={1}>1 week</option>
                <option value={2}>2 weeks</option>
                <option value={3}>3 weeks</option>
                <option value={4}>4 weeks</option>
              </select>
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-brand-border/80 bg-brand-surface/50 p-6">
          <h2 className="font-display text-lg text-brand-gold-bright">Add staff availability</h2>
          <form onSubmit={addRosterEntry} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <input
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              placeholder="Staff name"
              className="rounded-lg border border-white/15 bg-brand-night/40 px-3 py-2 text-sm text-brand-champagne"
            />
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value as StaffRow["department"])}
              className="rounded-lg border border-white/15 bg-brand-night/40 px-3 py-2 text-sm text-brand-champagne"
            >
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Role (optional)"
              className="rounded-lg border border-white/15 bg-brand-night/40 px-3 py-2 text-sm text-brand-champagne"
            />
            <label className="flex items-center gap-2 rounded-lg border border-white/15 bg-brand-night/40 px-3 py-2 text-sm text-brand-champagne">
              <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} />
              Available
            </label>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg border border-brand-gold/40 bg-brand-gold/15 px-4 py-2 text-sm font-semibold text-brand-gold-bright transition hover:bg-brand-gold/25 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Add staff"}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-brand-border/80 bg-brand-surface/50 p-6">
          <h2 className="font-display text-lg text-brand-gold-bright">Bulk import CSV</h2>
          <p className="mt-2 text-xs text-brand-muted">Header: name,department,role,shift_date,available</p>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={6}
            className="mt-3 w-full rounded-lg border border-white/15 bg-brand-night/40 px-3 py-2 text-sm text-brand-champagne"
            placeholder={"name,department,role,shift_date,available\nJordan Smith,banquets,Captain,2026-05-12,true"}
          />
          <button
            type="button"
            disabled={importing}
            onClick={importCsv}
            className="mt-3 rounded-lg border border-brand-gold/40 bg-brand-gold/15 px-4 py-2 text-sm font-semibold text-brand-gold-bright transition hover:bg-brand-gold/25 disabled:opacity-50"
          >
            {importing ? "Importing…" : "Import CSV"}
          </button>
        </section>

        <section className="rounded-2xl border border-brand-border/80 bg-brand-surface/50 p-6">
          <h2 className="font-display text-lg text-brand-gold-bright">Planner grid (multi-week)</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setDeptFilter("all")}
              className={`rounded-lg border px-3 py-1 text-xs ${deptFilter === "all" ? "border-brand-gold/50 bg-brand-gold/20 text-brand-gold-bright" : "border-white/15 text-brand-muted"}`}
            >
              All
            </button>
            {departments.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDeptFilter(d)}
                className={`rounded-lg border px-3 py-1 text-xs capitalize ${
                  deptFilter === d ? "border-brand-gold/50 bg-brand-gold/20 text-brand-gold-bright" : "border-white/15 text-brand-muted"
                }`}
              >
                {d}
              </button>
            ))}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-lg border border-white/15 bg-brand-night/40 px-3 py-1 text-xs text-brand-champagne"
            >
              <option value="all">All roles</option>
              {availableRoles.map((roleName) => (
                <option key={roleName} value={roleName}>
                  {roleName}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={copyingWeek}
              onClick={copyPreviousWeek}
              className="ml-auto rounded-lg border border-brand-gold/40 bg-brand-gold/15 px-3 py-1 text-xs font-semibold text-brand-gold-bright transition hover:bg-brand-gold/25 disabled:opacity-50"
            >
              {copyingWeek ? "Copying…" : `Copy previous ${weeksToShow} week${weeksToShow > 1 ? "s" : ""}`}
            </button>
          </div>
          <div className="mt-3 rounded-xl border border-white/10 bg-brand-night/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold-dim">Bulk date-range update</p>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <label className="text-xs text-brand-muted">
                Start
                <input
                  type="date"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                  className="mt-1 block rounded border border-white/15 bg-brand-night/40 px-2 py-1 text-brand-champagne"
                />
              </label>
              <label className="text-xs text-brand-muted">
                End
                <input
                  type="date"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                  className="mt-1 block rounded border border-white/15 bg-brand-night/40 px-2 py-1 text-brand-champagne"
                />
              </label>
              <label className="flex items-center gap-2 rounded border border-white/15 bg-brand-night/40 px-2 py-1 text-xs text-brand-champagne">
                <input type="checkbox" checked={bulkAvailable} onChange={(e) => setBulkAvailable(e.target.checked)} />
                Set available
              </label>
              <button
                type="button"
                disabled={bulkApplying}
                onClick={applyBulkAvailability}
                className="rounded border border-brand-gold/40 bg-brand-gold/15 px-3 py-1 text-xs font-semibold text-brand-gold-bright transition hover:bg-brand-gold/25 disabled:opacity-50"
              >
                {bulkApplying ? "Applying…" : "Apply to selected staff"}
              </button>
              <span className="text-xs text-brand-muted">{selectedStaffKeys.size} staff selected</span>
            </div>
          </div>
          {weeklyLoading ? (
            <p className="mt-3 text-brand-muted">Loading weekly roster…</p>
          ) : filteredWeeklyStaff.length === 0 ? (
            <p className="mt-3 text-brand-muted">No roster entries this week yet.</p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
              <table className="min-w-[980px] w-full text-left text-sm">
                <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-brand-muted">
                  <tr>
                    <th className="px-3 py-2 text-center">Select</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Dept</th>
                    <th className="px-3 py-2">Role</th>
                    {weekDates.map((d) => (
                      <th key={d} className="px-3 py-2 text-center">{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredWeeklyStaff.map((staff) => (
                    <tr key={staff.key} className="border-b border-white/5">
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={selectedStaffKeys.has(staff.key)}
                          onChange={(e) =>
                            setSelectedStaffKeys((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(staff.key);
                              else next.delete(staff.key);
                              return next;
                            })
                          }
                        />
                      </td>
                      <td className="px-3 py-2 text-brand-champagne">{staff.staff_name}</td>
                      <td className="px-3 py-2 capitalize text-brand-muted">{staff.department}</td>
                      <td className="px-3 py-2 text-brand-muted">{staff.role ?? "—"}</td>
                      {weekDates.map((d) => {
                        const row = findWeeklyRow(staff.key, d);
                        const checked = Boolean(row?.available);
                        return (
                          <td key={`${staff.key}-${d}`} className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => toggleWeeklyAvailability(staff.key, d, e.target.checked)}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-brand-border/80 bg-brand-surface/50 p-6">
          <h2 className="font-display text-lg text-brand-gold-bright">Available roster</h2>
          {loading ? (
            <p className="mt-3 text-brand-muted">Loading roster…</p>
          ) : rows.length === 0 ? (
            <p className="mt-3 text-brand-muted">No available staff found for this date.</p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-brand-muted">
                  <tr>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Department</th>
                    <th className="px-4 py-2">Role</th>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-white/5">
                      <td className="px-4 py-2 text-brand-champagne">{row.staff_name}</td>
                      <td className="px-4 py-2 capitalize text-brand-muted">{row.department}</td>
                      <td className="px-4 py-2 text-brand-muted">{row.role ?? "—"}</td>
                      <td className="px-4 py-2 text-brand-muted">{row.shift_date}</td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setRowAvailability(row.id, !row.available)}
                            className="rounded border border-white/20 px-2 py-1 text-xs text-brand-champagne hover:bg-white/5"
                          >
                            {row.available ? "Mark unavailable" : "Mark available"}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteRow(row.id)}
                            className="rounded border border-red-400/40 px-2 py-1 text-xs text-red-200 hover:bg-red-900/30"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {error ? <p className="mt-3 text-sm text-red-200">{error}</p> : null}
        </section>
      </div>
    </main>
  );
}
