import Link from "next/link";
import { notFound } from "next/navigation";
import ApprovePromoteButton from "@/components/manager/ApprovePromoteButton";
import type { NormalizedBeoRecord } from "@/lib/beo/types";
import { validateBeoRecord } from "@/lib/beo/validate";
import type { ParsedBEO } from "@/lib/types";
import { getEvent, getEventVersionById } from "@/lib/store";

type PageProps = {
  params: Promise<{ id: string; versionId: string }>;
};

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function normalizedFromVersion(version: NonNullable<Awaited<ReturnType<typeof getEventVersionById>>>): NormalizedBeoRecord | null {
  const n = version.normalized_json;
  if (n !== null && typeof n === "object" && !Array.isArray(n)) {
    return n as NormalizedBeoRecord;
  }
  return null;
}

type EvidenceEntry = { confidence?: number | null; sourceExcerpt?: string | null };

function fieldEvidence(
  record: NormalizedBeoRecord,
  field: string,
): EvidenceEntry | undefined {
  const fe = record.fieldEvidence as Record<string, EvidenceEntry> | undefined;
  return fe?.[field];
}

function FieldTile({
  label,
  fieldKey,
  value,
  evidence,
  warnKeys,
}: {
  label: string;
  fieldKey: string;
  value: string;
  evidence?: EvidenceEntry;
  warnKeys: Set<string>;
}) {
  const c = evidence?.confidence;
  const lowConfidence = c != null && c < 0.85;
  const unverified = c == null;
  const warn = warnKeys.has(fieldKey) || lowConfidence || unverified;

  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5",
        warn
          ? "border-amber-400/45 bg-amber-500/10 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.12)]"
          : "border-white/10 bg-brand-night/40",
      )}
    >
      <dt className="text-[11px] font-medium uppercase tracking-wide text-brand-muted">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-brand-champagne">{value}</dd>
      <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-brand-muted">
        {c != null ? <span>{Math.round(c * 100)}% confidence</span> : <span>Unverified extraction</span>}
        {lowConfidence ? <span className="text-amber-200">Low confidence</span> : null}
      </div>
    </div>
  );
}

export default async function VersionReviewPage({ params }: PageProps) {
  const { id: eventId, versionId } = await params;

  const [event, version] = await Promise.all([getEvent(eventId), getEventVersionById(versionId)]);
  if (!event || !version || version.event_id !== eventId) {
    notFound();
  }

  const normalized = normalizedFromVersion(version);
  const parsed = version.parsed_json as ParsedBEO;

  if (!normalized) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-12 text-brand-champagne">
        <p className="text-brand-muted">
          This version has no normalized record. Finish the pipeline before manager review.
        </p>
        <Link href={`/dashboard/events/${eventId}/command`} className="mt-4 inline-block text-brand-gold-bright">
          ← Command
        </Link>
      </main>
    );
  }

  const validation = validateBeoRecord(normalized);
  const warnFieldKeys = new Set(validation.warnings.map((w) => w.field));

  const guestCount =
    normalized.guaranteedGuests ?? normalized.expectedGuests ?? parsed.guest_count ?? null;

  const evidence = normalized.fieldEvidence ?? {};
  const excerptEntries = Object.entries(evidence)
    .filter(([, v]) => v && typeof v === "object" && v.sourceExcerpt)
    .slice(0, 20) as Array<[string, EvidenceEntry]>;

  const isLivePointer = event.current_version_id === versionId;

  return (
    <main className="min-h-screen bg-gradient-to-b from-brand-navy/95 to-brand-night px-4 pb-24 pt-8 text-brand-champagne sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-col gap-6 border-b border-brand-border/80 pb-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-gold-dim">
              Version review
            </p>
            <h1 className="font-display mt-2 text-2xl font-semibold sm:text-3xl">{event.event_name}</h1>
            <p className="mt-2 text-sm text-brand-muted">
              BEO version <span className="text-brand-champagne">v{version.version_number}</span>
              {isLivePointer ? (
                <span className="ml-2 rounded-full border border-emerald-400/40 px-2 py-0.5 text-xs text-emerald-200">
                  Live pinned
                </span>
              ) : null}
            </p>
          </div>
          <Link
            href={`/dashboard/events/${eventId}/command`}
            className="shrink-0 self-start rounded-xl border border-brand-border px-4 py-2 text-sm text-brand-gold-bright transition hover:bg-white/5"
          >
            ← Command
          </Link>
        </header>

        <section className="mb-10 flex flex-col items-center gap-4 rounded-2xl border border-emerald-500/25 bg-emerald-950/20 p-8">
          <p className="max-w-xl text-center text-sm text-brand-muted">
            This publishes the version to live operations: pins the revision, archives open tasks, regenerates{" "}
            <code className="text-brand-gold-dim">event_tasks</code>, persists briefings with version traceability, logs
            activity, and refreshes readiness.
          </p>
          <ApprovePromoteButton eventId={eventId} versionId={versionId} disabled={isLivePointer} />
          {isLivePointer ? (
            <p className="text-xs text-brand-muted">Already promoted — pick another revision to re-run the pipeline.</p>
          ) : null}
        </section>

        <div className="grid gap-8 lg:grid-cols-2">
          <section className="rounded-2xl border border-brand-border bg-brand-surface/50 p-5">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-gold-dim">Critical fields</h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <FieldTile
                label="Event name"
                fieldKey="eventName"
                value={normalized.eventName ?? "—"}
                evidence={fieldEvidence(normalized, "eventName")}
                warnKeys={warnFieldKeys}
              />
              <FieldTile
                label="Event date"
                fieldKey="eventDate"
                value={normalized.eventDate ?? "—"}
                evidence={fieldEvidence(normalized, "eventDate")}
                warnKeys={warnFieldKeys}
              />
              <FieldTile
                label="Room"
                fieldKey="roomName"
                value={normalized.roomName ?? event.room_name ?? "—"}
                evidence={fieldEvidence(normalized, "roomName")}
                warnKeys={warnFieldKeys}
              />
              <FieldTile
                label="Guest count"
                fieldKey="guaranteedGuests"
                value={guestCount != null ? String(guestCount) : "—"}
                evidence={fieldEvidence(normalized, "guaranteedGuests") ?? fieldEvidence(normalized, "expectedGuests")}
                warnKeys={warnFieldKeys}
              />
              <FieldTile
                label="Service style"
                fieldKey="serviceStyle"
                value={String(normalized.serviceStyle ?? "—")}
                evidence={fieldEvidence(normalized, "serviceStyle")}
                warnKeys={warnFieldKeys}
              />
              <FieldTile
                label="Guest arrival"
                fieldKey="guestArrivalTime"
                value={normalized.guestArrivalTime ?? "—"}
                evidence={fieldEvidence(normalized, "guestArrivalTime")}
                warnKeys={warnFieldKeys}
              />
              <FieldTile
                label="Service start"
                fieldKey="serviceStartTime"
                value={normalized.serviceStartTime ?? "—"}
                evidence={fieldEvidence(normalized, "serviceStartTime")}
                warnKeys={warnFieldKeys}
              />
            </dl>

            <div className="mt-6 space-y-4">
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Dietary flags</h3>
                {normalized.dietaryFlags?.length ? (
                  <ul className="mt-2 space-y-1 text-sm">
                    {normalized.dietaryFlags.map((d, i) => (
                      <li key={i} className="rounded-lg bg-brand-night/50 px-2 py-1">
                        <span className="font-medium capitalize text-amber-100/90">{d.type}</span>
                        {d.count != null ? <span className="text-brand-muted"> ×{d.count}</span> : null}
                        {d.priority === "critical" ? (
                          <span className="ml-2 text-xs font-semibold text-red-300">Critical</span>
                        ) : null}
                        {d.originalText ? (
                          <p className="text-xs text-brand-muted">{d.originalText}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-brand-muted">None recorded.</p>
                )}
              </div>
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Special requests</h3>
                {normalized.specialRequests?.length ? (
                  <ul className="mt-2 list-inside list-disc text-sm text-brand-champagne/90">
                    {normalized.specialRequests.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-brand-muted">None.</p>
                )}
              </div>
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Equipment</h3>
                {normalized.equipment?.length ? (
                  <ul className="mt-2 space-y-1 text-sm">
                    {normalized.equipment.map((e, i) => (
                      <li key={i}>
                        {e.name}
                        {e.quantity != null ? <span className="text-brand-muted"> ×{e.quantity}</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-brand-muted">None.</p>
                )}
              </div>
            </div>
          </section>

          <div className="space-y-8">
            <section
              className={cn(
                "rounded-2xl border p-5",
                validation.severity === "review_required" || validation.errors.length
                  ? "border-red-400/40 bg-red-950/25"
                  : validation.warnings.length
                    ? "border-amber-400/35 bg-amber-950/20"
                    : "border-brand-border bg-brand-surface/50",
              )}
            >
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-gold-dim">Validation</h2>
              <p className="mt-2 text-sm capitalize text-brand-champagne">
                Severity: <span className="font-semibold">{validation.severity}</span>
              </p>
              {validation.errors.length > 0 ? (
                <ul className="mt-3 space-y-1 text-sm text-red-200/95">
                  {validation.errors.map((e, i) => (
                    <li key={`e-${i}`}>{e.message}</li>
                  ))}
                </ul>
              ) : null}
              {validation.warnings.length > 0 ? (
                <ul className="mt-3 space-y-1 text-sm text-amber-100/95">
                  {validation.warnings.map((w, i) => (
                    <li key={`w-${i}`}>{w.message}</li>
                  ))}
                </ul>
              ) : null}
            </section>

            <section className="rounded-2xl border border-brand-border bg-brand-surface/50 p-5">
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-gold-dim">Source excerpts</h2>
              <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto text-sm">
                {excerptEntries.length === 0 ? (
                  <li className="text-brand-muted">No excerpts on this snapshot.</li>
                ) : (
                  excerptEntries.map(([field, meta]) => (
                    <li key={field} className="rounded-lg border border-white/10 bg-brand-night/40 px-3 py-2">
                      <span className="font-medium text-brand-gold-bright">{field}</span>
                      {meta.confidence != null ? (
                        <span className="ml-2 text-xs text-brand-muted">{Math.round(meta.confidence * 100)}%</span>
                      ) : null}
                      <blockquote className="mt-1 border-l-2 border-brand-gold/35 pl-2 text-xs text-brand-champagne/85">
                        {meta.sourceExcerpt}
                      </blockquote>
                    </li>
                  ))
                )}
              </ul>
            </section>

            <details className="rounded-2xl border border-brand-border bg-brand-surface/40 p-5">
              <summary className="cursor-pointer text-sm font-medium text-brand-gold-bright">
                Parsed version (raw structured extract)
              </summary>
              <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-brand-night/80 p-3 text-[11px] leading-relaxed text-brand-muted">
                {JSON.stringify(parsed, null, 2)}
              </pre>
            </details>
          </div>
        </div>

      </div>
    </main>
  );
}
