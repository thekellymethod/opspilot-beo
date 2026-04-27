"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import EventBriefingPage, { type EventBriefingPageProps } from "@/components/beo/EventBriefingPage";
import type { BriefingOperationalOverview } from "@/lib/beo/loadEventBriefing";
import type { BriefingValidationSummary, BriefingVersionMeta } from "@/lib/beo/briefingMeta";
import type { OperationalChange } from "@/lib/beo/changeDetector";
import type { BriefingLevel, EventBriefing } from "@/lib/beo/briefingGenerator";
import type { EventManagerNoteRecord } from "@/lib/types";

type BriefingPayload = {
  briefing: string;
  briefingDoc?: EventBriefing;
  level?: BriefingLevel;
  event: { event_name: string; event_date: string; room_name: string };
  error?: string;
  briefingLocation?: string | null;
  briefingStatus?: EventBriefingPageProps["status"];
  operationalChanges?: OperationalChange[];
  validation?: BriefingValidationSummary;
  versionMeta?: BriefingVersionMeta;
  operationalOverview?: BriefingOperationalOverview;
  managerNotes?: EventManagerNoteRecord[];
  eventId?: string;
};

function formatEventDate(isoOrDate: string): string {
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return isoOrDate;
  return d.toLocaleDateString(undefined, { dateStyle: "long" });
}

export default function BriefingPage({ params }: { params: Promise<{ id: string }> }) {
  const [eventId, setEventId] = useState<string>("");
  const [level, setLevel] = useState<BriefingLevel>("management");
  const [payload, setPayload] = useState<BriefingPayload | null>(null);
  const [fetchCounter, setFetchCounter] = useState(0);

  useEffect(() => {
    params.then(({ id }) => setEventId(id));
  }, [params]);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    fetch(`/api/events/${eventId}/briefing?level=${level}`)
      .then((response) => response.json())
      .then((json) => {
        if (!cancelled) setPayload(json as BriefingPayload);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, level, fetchCounter]);

  const refresh = useCallback(() => {
    setFetchCounter((c) => c + 1);
  }, []);

  const exportBriefing = useCallback(() => {
    window.print();
  }, []);

  const doc = payload?.briefingDoc;
  const eventDateLabel = payload?.event?.event_date ? formatEventDate(payload.event.event_date) : null;

  if (!payload || payload.error) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 text-sm text-brand-muted">
        {payload?.error ?? "Loading briefing…"}
      </main>
    );
  }

  if (!doc) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
        <article className="rounded-2xl border border-brand-border bg-brand-surface/60 p-4 text-base leading-7 text-brand-champagne/90">
          {payload.briefing}
        </article>
        <Link href={`/events/${eventId}`} className="text-sm text-brand-gold-bright underline-offset-2 hover:underline">
          Back to event details
        </Link>
      </main>
    );
  }

  const status = payload.briefingStatus ?? "approved";
  const location = payload.briefingLocation ?? payload.event.room_name ?? null;

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-brand-border bg-brand-navy/90 print:hidden">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Link href={`/events/${eventId}`} className="font-medium text-brand-gold-bright hover:text-brand-champagne">
              ← Event details
            </Link>
            <span className="text-brand-muted/50">|</span>
            <span className="text-brand-muted">Briefing depth</span>
            <div className="flex rounded-xl border border-brand-border/80 bg-brand-surface/60 p-0.5">
              {(["executive", "management", "department"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLevel(l)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition ${
                    level === l
                      ? "bg-brand-gold/25 text-brand-champagne shadow-[0_0_16px_-6px_rgba(201,168,76,0.4)]"
                      : "text-brand-muted hover:text-brand-gold-bright"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <EventBriefingPage
        briefing={doc}
        eventDate={eventDateLabel}
        location={location}
        status={status}
        operationalChanges={payload.operationalChanges ?? []}
        validation={payload.validation ?? null}
        versionMeta={payload.versionMeta ?? null}
        operationalOverview={payload.operationalOverview ?? null}
        managerNotes={payload.managerNotes ?? []}
        eventId={payload.eventId ?? eventId}
        onRefresh={refresh}
        onExport={exportBriefing}
      />
    </div>
  );
}
