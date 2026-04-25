"use client";

import { useMemo, useState } from "react";
import type { EventTaskRecord } from "@/lib/types";

type TaskSummaryPanelProps = {
  tasks: EventTaskRecord[];
};

function groupByDepartment(tasks: EventTaskRecord[]) {
  const map = new Map<string, EventTaskRecord[]>();
  for (const t of tasks) {
    const list = map.get(t.department) ?? [];
    list.push(t);
    map.set(t.department, list);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
}

export default function TaskSummaryPanel({ tasks }: TaskSummaryPanelProps) {
  const groups = useMemo(() => groupByDepartment(tasks), [tasks]);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  if (!tasks.length) {
    return (
      <section className="rounded-2xl border border-brand-border bg-brand-surface/50 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-gold-dim">Tasks</h2>
        <p className="mt-3 text-sm text-brand-muted">No tasks in event_tasks for this event.</p>
      </section>
    );
  }

  function toggle(dept: string) {
    setOpen((prev) => ({ ...prev, [dept]: !prev[dept] }));
  }

  return (
    <section className="rounded-2xl border border-brand-border bg-brand-surface/50 p-5">
      <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-gold-dim">Task summary</h2>
      <div className="mt-4 space-y-2">
        {groups.map(([dept, list]) => {
          const expanded = open[dept] ?? false;
          return (
            <div key={dept} className="rounded-xl border border-white/10 bg-brand-night/35 capitalize">
              <button
                type="button"
                onClick={() => toggle(dept)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-brand-champagne transition hover:bg-white/5"
              >
                <span>{dept}</span>
                <span className="text-xs text-brand-muted">
                  {list.filter((t) => t.status === "complete").length}/{list.length} · {expanded ? "▼" : "▶"}
                </span>
              </button>
              {expanded ? (
                <ul className="border-t border-white/5 px-4 py-2 space-y-2 text-sm normal-case">
                  {list.map((t) => (
                    <li key={t.id} className="flex flex-wrap justify-between gap-2 border-b border-white/5 pb-2 last:border-0">
                      <span className="text-brand-champagne/90">{t.title}</span>
                      <span className="text-xs text-brand-muted">
                        {t.status}
                        <span className="mx-1 text-brand-muted/50">·</span>
                        Unassigned
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
