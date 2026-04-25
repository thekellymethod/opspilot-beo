"use client";

import React, { useMemo, useState } from "react";
import type { BriefingValidationSummary, BriefingVersionMeta } from "@/lib/beo/briefingMeta";
import type { OperationalChange } from "@/lib/beo/changeDetector";
import type { BriefingDepartment, EventBriefing } from "@/lib/beo/briefingGenerator";

export type EventBriefingPageProps = {
  briefing: EventBriefing;
  eventDate?: string | null;
  location?: string | null;
  status?: "draft" | "review" | "approved" | "live";
  operationalChanges?: OperationalChange[];
  validation?: BriefingValidationSummary | null;
  versionMeta?: BriefingVersionMeta | null;
  onRefresh?: () => void;
  onExport?: () => void;
};

const ACK_LEADS = ["kitchen", "banquets", "management"] as const;
type AckLeadKey = (typeof ACK_LEADS)[number];

const ACK_LABELS: Record<AckLeadKey, string> = {
  kitchen: "Kitchen lead",
  banquets: "Banquets lead",
  management: "Management",
};

const DEPARTMENT_ORDER: BriefingDepartment[] = [
  "management",
  "kitchen",
  "banquets",
  "bar",
  "setup",
  "av",
];

const DEPARTMENT_LABELS: Record<BriefingDepartment, string> = {
  management: "Management",
  kitchen: "Kitchen",
  banquets: "Banquets",
  bar: "Bar",
  setup: "Setup",
  av: "AV",
};

function buildAckStorageKey(eventId: string | undefined, version: number | null | undefined) {
  if (!eventId) return null;
  const v = version ?? 0;
  return `opspilot-briefing-ack-${eventId}-v${v}`;
}

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function getStatusBadgeClasses(status?: EventBriefingPageProps["status"]) {
  switch (status) {
    case "live":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 print:border-emerald-800 print:bg-emerald-50 print:text-emerald-900";
    case "approved":
      return "border-blue-500/30 bg-blue-500/10 text-blue-300 print:border-blue-800 print:bg-blue-50 print:text-blue-900";
    case "review":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300 print:border-amber-800 print:bg-amber-50 print:text-amber-900";
    case "draft":
    default:
      return "border-white/10 bg-white/5 text-white/70 print:border-slate-400 print:bg-slate-100 print:text-slate-800";
  }
}

function getRiskTone(risk: string) {
  const value = risk.toLowerCase();

  if (value.includes("critical") || value.includes("allergy") || value.includes("conflict")) {
    return "border-red-500/30 bg-red-500/10 text-red-200 print:border-red-300 print:bg-red-50 print:text-red-900";
  }

  if (
    value.includes("missing") ||
    value.includes("unknown") ||
    value.includes("pressure") ||
    value.includes("confirm")
  ) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-200 print:border-amber-300 print:bg-amber-50 print:text-amber-900";
  }

  return "border-white/10 bg-white/5 text-white/80 print:border-slate-300 print:bg-slate-50 print:text-slate-800";
}

function SectionCard({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "eb-card rounded-2xl border border-white/10 bg-brand-surface/95 shadow-[0_8px_30px_rgba(0,0,0,0.25)] print:border-slate-300 print:bg-slate-50 print:shadow-none",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 print:border-slate-300">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-gold print:text-amber-900">{title}</h2>
        {action}
      </div>
      <div className="p-5 print:text-slate-900">{children}</div>
    </section>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-white/50 print:border-slate-300 print:bg-white print:text-slate-600">
      {label}
    </div>
  );
}

function HeaderMeta({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 print:border-slate-300 print:bg-white">
      <div className="text-[11px] uppercase tracking-[0.18em] text-white/45 print:text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-white/90 print:text-slate-900">{value}</div>
    </div>
  );
}

function DepartmentTabButton({
  active,
  label,
  onClick,
  count,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition print:hidden",
        active
          ? "border-brand-gold/45 bg-brand-gold/15 text-brand-champagne"
          : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06]",
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-[11px]",
          active ? "bg-brand-gold/25 text-brand-champagne" : "bg-white/10 text-white/55",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function IconDot({ tone = "default" }: { tone?: "default" | "risk" | "change" | "fact" | "timeline" }) {
  const toneClass =
    tone === "risk"
      ? "bg-red-300 print:bg-red-600"
      : tone === "change"
        ? "bg-amber-300 print:bg-amber-600"
        : tone === "fact"
          ? "bg-brand-gold print:bg-amber-700"
          : tone === "timeline"
            ? "bg-blue-300 print:bg-blue-600"
            : "bg-white/50 print:bg-slate-500";

  return <span className={cn("mt-2 h-2 w-2 shrink-0 rounded-full", toneClass)} />;
}

function RevisionBanner({
  changeCount,
  versionMeta,
}: {
  changeCount: number;
  versionMeta: BriefingVersionMeta | null | undefined;
}) {
  const versionLabel =
    versionMeta?.previousVersion != null && versionMeta.currentVersion != null
      ? ` (v${versionMeta.previousVersion} → v${versionMeta.currentVersion})`
      : "";

  return (
    <div
      role="status"
      className="mb-4 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100 print:border-amber-400 print:bg-amber-50 print:text-amber-950"
    >
      <p className="font-semibold text-amber-50 print:text-amber-950">Latest revision{versionLabel}</p>
      <p className="mt-1 text-amber-100/90 print:text-amber-900">
        Change detection recorded{" "}
        <span className="font-semibold">
          {changeCount} operational change{changeCount === 1 ? "" : "s"}
        </span>{" "}
        since the previous BEO version. Review Recent Changes and risk flags before service.
      </p>
    </div>
  );
}

function ValidationBanner({ validation }: { validation: BriefingValidationSummary }) {
  if (validation.severity === "ok") return null;

  if (validation.severity === "review_required") {
    return (
      <div
        role="alert"
        className="mb-4 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-100 print:border-red-400 print:bg-red-50 print:text-red-950"
      >
        <p className="font-semibold text-red-50 print:text-red-950">Validation — review required</p>
        <p className="mt-1 text-red-100/90 print:text-red-900">
          {validation.errorCount} blocking issue{validation.errorCount === 1 ? "" : "s"} must be cleared or corrected in
          the source BEO before this briefing can be treated as authoritative.
        </p>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100 print:border-amber-400 print:bg-amber-50 print:text-amber-950"
    >
      <p className="font-semibold text-amber-50 print:text-amber-950">Validation — warnings present</p>
      <p className="mt-1 text-amber-100/90 print:text-amber-900">
        {validation.warningCount} warning{validation.warningCount === 1 ? "" : "s"} on the normalized record. Confirm
        details with the event file or sales lead.
      </p>
    </div>
  );
}

const defaultAck: Record<AckLeadKey, boolean> = {
  kitchen: false,
  banquets: false,
  management: false,
};

function readAckFromStorage(eventId: string | undefined, version: number | null | undefined): Record<AckLeadKey, boolean> {
  const key = buildAckStorageKey(eventId, version);
  if (typeof window === "undefined" || !key) {
    return { ...defaultAck };
  }
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { ...defaultAck };
    const parsed = JSON.parse(raw) as Partial<Record<AckLeadKey, boolean>>;
    return { ...defaultAck, ...parsed };
  } catch {
    return { ...defaultAck };
  }
}

function LeadAcknowledgmentBar({ eventId, version }: { eventId?: string; version?: number | null }) {
  const [ack, setAck] = useState<Record<AckLeadKey, boolean>>(() => readAckFromStorage(eventId, version));

  const persist = (next: Record<AckLeadKey, boolean>) => {
    const key = buildAckStorageKey(eventId, version);
    if (key) {
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    }
  };

  const onToggle = (k: AckLeadKey) => {
    setAck((prev) => {
      const next = { ...prev, [k]: !prev[k] };
      persist(next);
      return next;
    });
  };

  return (
    <section className="eb-card mb-6 rounded-2xl border border-white/10 bg-brand-surface/95 px-4 py-4 shadow-[0_8px_30px_rgba(0,0,0,0.25)] print:border-slate-300 print:bg-slate-50 print:shadow-none sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-gold print:text-amber-900">
            Lead acknowledgment
          </h2>
          <p className="mt-1 text-xs text-white/55 print:text-slate-600">
            Kitchen, banquets, and management confirm they have read this revision (stored on this device).
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          {ACK_LEADS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onToggle(key)}
              className={cn(
                "rounded-xl border px-3 py-2 text-xs font-medium transition",
                ack[key]
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                  : "border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]",
              )}
            >
              {ACK_LABELS[key]}: {ack[key] ? "Acknowledged" : "Tap to acknowledge"}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 hidden border-t border-white/10 pt-3 text-xs text-slate-800 print:block print:border-slate-200">
        <span className="font-semibold">Print summary — </span>
        {ACK_LEADS.map((key) => (
          <span key={key} className="mr-4">
            {ACK_LABELS[key]}: {ack[key] ? "Yes" : "No"}
          </span>
        ))}
      </div>
    </section>
  );
}

export default function EventBriefingPage({
  briefing,
  eventDate,
  location,
  status = "draft",
  operationalChanges = [],
  validation = null,
  versionMeta = null,
  onRefresh,
  onExport,
}: EventBriefingPageProps) {
  const [activeDepartment, setActiveDepartment] = useState<BriefingDepartment>("management");

  const departmentEntries = useMemo(
    () =>
      DEPARTMENT_ORDER.map((key) => ({
        key,
        label: DEPARTMENT_LABELS[key],
        items: briefing.departmentNotes[key] ?? [],
      })),
    [briefing.departmentNotes],
  );

  const activeNotes = briefing.departmentNotes[activeDepartment] ?? [];

  const totalIssues = briefing.risks.length + briefing.changes.length;
  const changeDetectionCount = operationalChanges.length;

  return (
    <div className="event-briefing-root relative min-h-screen bg-brand-night text-white print:min-h-0 print:bg-white print:text-slate-900">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_55%_at_50%_-8%,rgba(201,168,76,0.14),transparent_52%),linear-gradient(180deg,rgba(10,31,53,0.97)_0%,rgba(5,10,16,0.98)_55%,rgba(107,31,46,0.08)_100%)]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 print:px-2 print:py-3">
        {changeDetectionCount > 0 ? (
          <RevisionBanner changeCount={changeDetectionCount} versionMeta={versionMeta} />
        ) : null}
        {validation ? <ValidationBanner validation={validation} /> : null}

        <LeadAcknowledgmentBar
          key={`${briefing.eventId ?? "event"}-${versionMeta?.currentVersion ?? 0}`}
          eventId={briefing.eventId}
          version={versionMeta?.currentVersion}
        />

        <div className="eb-card mb-6 overflow-hidden rounded-[28px] border border-brand-border/80 bg-gradient-to-br from-white/[0.07] via-brand-surface/40 to-brand-burgundy/15 shadow-[0_12px_40px_rgba(0,0,0,0.35)] print:border-slate-300 print:bg-white print:shadow-none">
          <div className="border-b border-white/10 px-6 py-5 print:border-slate-300">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-4xl">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
                      getStatusBadgeClasses(status),
                    )}
                  >
                    {status}
                  </span>

                  {briefing.eventId ? (
                    <span className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/50 print:border-slate-300 print:bg-slate-100 print:text-slate-600">
                      {briefing.eventId}
                    </span>
                  ) : null}

                  <span className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/50 print:border-slate-300 print:bg-slate-100 print:text-slate-600">
                    {totalIssues} active issue{totalIssues === 1 ? "" : "s"}
                  </span>
                </div>

                <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl print:text-slate-900">
                  {briefing.headline}
                </h1>

                {briefing.summary ? (
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70 sm:text-base print:text-slate-700">
                    {briefing.summary}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-wrap gap-3 print:hidden">
                {onRefresh ? (
                  <button
                    type="button"
                    onClick={() => onRefresh()}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/80 transition hover:bg-white/[0.08]"
                  >
                    Refresh
                  </button>
                ) : null}
                {onExport ? (
                  <button
                    type="button"
                    onClick={() => onExport()}
                    className="rounded-xl border border-brand-gold/40 bg-brand-gold/15 px-4 py-2 text-sm font-medium text-brand-champagne transition hover:bg-brand-gold/25"
                  >
                    Print / PDF
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-3 px-6 py-5 sm:grid-cols-2 lg:grid-cols-4">
            <HeaderMeta label="Event Date" value={eventDate} />
            <HeaderMeta label="Location" value={location} />
            <HeaderMeta label="Primary Risk Count" value={String(briefing.risks.length)} />
            <HeaderMeta label="Recent Changes" value={String(briefing.changes.length)} />
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr] print:grid-cols-1 print:gap-3">
          <div className="space-y-6 print:space-y-3">
            <SectionCard title="Operational Snapshot">
              {briefing.keyFacts.length === 0 ? (
                <EmptyState label="No key facts available." />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 print:grid-cols-2">
                  {briefing.keyFacts.map((fact) => (
                    <div
                      key={fact}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 print:border-slate-300 print:bg-white"
                    >
                      <div className="flex items-start gap-3">
                        <IconDot tone="fact" />
                        <div className="text-sm leading-6 text-white/88 print:text-slate-800">{fact}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Timeline">
              {briefing.timeline.length === 0 ? (
                <EmptyState label="No timeline data available." />
              ) : (
                <div className="space-y-3 print:space-y-1.5">
                  {briefing.timeline.map((item, idx) => (
                    <div
                      key={`${item}-${idx}`}
                      className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 print:border-slate-300 print:bg-white print:py-2"
                    >
                      <div className="flex min-w-[28px] justify-center">
                        <div className="mt-1 flex h-7 w-7 items-center justify-center rounded-full border border-blue-400/30 bg-blue-400/10 text-xs font-semibold text-blue-200 print:border-blue-300 print:bg-blue-50 print:text-blue-900">
                          {idx + 1}
                        </div>
                      </div>
                      <div className="flex items-start gap-3 text-sm leading-6 text-white/88 print:text-slate-800">
                        <IconDot tone="timeline" />
                        <span>{item}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Department Briefing">
              <div className="mb-5 flex flex-wrap gap-2">
                {departmentEntries.map((entry) => (
                  <DepartmentTabButton
                    key={entry.key}
                    active={entry.key === activeDepartment}
                    label={entry.label}
                    count={entry.items.length}
                    onClick={() => setActiveDepartment(entry.key)}
                  />
                ))}
              </div>

              {activeNotes.length === 0 ? (
                <EmptyState label={`No ${DEPARTMENT_LABELS[activeDepartment]} notes available.`} />
              ) : (
                <div className="space-y-3 print:hidden">
                  {activeNotes.map((note, idx) => (
                    <div
                      key={`${activeDepartment}-${idx}-${note}`}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4"
                    >
                      <div className="flex items-start gap-3">
                        <IconDot tone="default" />
                        <p className="text-sm leading-6 text-white/88">{note}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="hidden print:block">
                {DEPARTMENT_ORDER.map((dept) => {
                  const notes = briefing.departmentNotes[dept] ?? [];
                  return (
                    <div key={dept} className="mb-4 border-b border-slate-200 pb-3 last:mb-0 last:border-0">
                      <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-900">
                        {DEPARTMENT_LABELS[dept]}
                      </h3>
                      {notes.length === 0 ? (
                        <p className="mt-1 text-xs text-slate-500">No notes.</p>
                      ) : (
                        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-800">
                          {notes.map((note) => (
                            <li key={note}>{note}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          </div>

          <div className="space-y-6 print:space-y-3">
            <SectionCard
              title="Risk Flags"
              action={
                briefing.risks.length > 0 ? (
                  <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-red-200 print:border-red-300 print:bg-red-50 print:text-red-900">
                    {briefing.risks.length} flag{briefing.risks.length === 1 ? "" : "s"}
                  </span>
                ) : undefined
              }
            >
              {briefing.risks.length === 0 ? (
                <EmptyState label="No current risks identified." />
              ) : (
                <div className="space-y-3 print:space-y-1.5">
                  {briefing.risks.map((risk, idx) => (
                    <div key={`${risk}-${idx}`} className={cn("rounded-2xl border px-4 py-4 print:py-2", getRiskTone(risk))}>
                      <div className="flex items-start gap-3">
                        <IconDot tone="risk" />
                        <p className="text-sm leading-6 print:text-inherit">{risk}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Recent Changes"
              action={
                briefing.changes.length > 0 ? (
                  <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-amber-200 print:border-amber-400 print:bg-amber-50 print:text-amber-900">
                    {briefing.changes.length} change{briefing.changes.length === 1 ? "" : "s"}
                  </span>
                ) : undefined
              }
            >
              {briefing.changes.length === 0 ? (
                <EmptyState label="No recent operational changes detected." />
              ) : (
                <div className="space-y-3 print:space-y-1.5">
                  {briefing.changes.map((change, idx) => (
                    <div
                      key={`${change}-${idx}`}
                      className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-4 text-amber-100 print:border-amber-300 print:bg-amber-50 print:text-amber-950 print:py-2"
                    >
                      <div className="flex items-start gap-3">
                        <IconDot tone="change" />
                        <p className="text-sm leading-6">{change}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <div className="print:hidden">
              <SectionCard title="Command Notes">
                <div className="space-y-3 text-sm leading-6 text-white/75">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                    Prioritize risk confirmation before guest arrival.
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                    If recent changes affect guest count, service style, or dietary handling, force acknowledgment from
                    kitchen and banquet leads.
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                    Use this page as the compressed operational view, not as the source of truth. Source-of-truth
                    updates should still write back to the event record.
                  </div>
                </div>
              </SectionCard>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
