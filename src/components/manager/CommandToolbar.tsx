"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type CommandToolbarProps = {
  eventId: string;
  pinnedVersionId: string | null;
  reviewHref: string;
  briefingHref: string;
  eventsHref?: string;
};

export default function CommandToolbar({
  eventId,
  pinnedVersionId,
  reviewHref,
  briefingHref,
  eventsHref = "/dashboard/events",
}: CommandToolbarProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reprocessError, setReprocessError] = useState("");

  function refresh() {
    router.refresh();
  }

  function reprocess() {
    if (!pinnedVersionId) return;
    setReprocessError("");
    startTransition(() => {
      void (async () => {
        const res = await fetch(`/api/events/${eventId}/versions/${pinnedVersionId}/promote`, {
          method: "POST",
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) {
          setReprocessError(data.error ?? "Reprocess failed.");
          return;
        }
        router.refresh();
      })();
    });
  }

  return (
    <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={refresh}
          className="rounded-lg border border-brand-border px-4 py-2 text-sm text-brand-champagne transition hover:bg-white/5"
        >
          Refresh
        </button>
        <button
          type="button"
          disabled={!pinnedVersionId || pending}
          onClick={reprocess}
          className="rounded-lg border border-brand-burgundy/40 bg-brand-burgundy/20 px-4 py-2 text-sm font-medium text-brand-champagne transition hover:bg-brand-burgundy/30 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {pending ? "Reprocessing…" : "Reprocess event"}
        </button>
      </div>
      <div className="hidden h-6 w-px bg-brand-border/60 sm:block" />
      <div className="flex flex-wrap gap-2">
        <Link
          href={reviewHref}
          className="rounded-lg border border-brand-border px-4 py-2 text-sm text-brand-gold-bright transition hover:bg-white/5"
        >
          Review &amp; promote
        </Link>
        <Link
          href={briefingHref}
          className="rounded-lg border border-brand-gold/35 bg-brand-gold/12 px-4 py-2 text-sm font-medium text-brand-gold-bright transition hover:bg-brand-gold/22"
        >
          Full briefing
        </Link>
        <Link
          href="/"
          className="rounded-lg border border-brand-border px-4 py-2 text-sm text-brand-champagne transition hover:bg-white/5"
        >
          Command center
        </Link>
        <Link href={eventsHref} className="rounded-lg px-4 py-2 text-sm text-brand-muted hover:text-brand-champagne">
          ← Events
        </Link>
      </div>
      {reprocessError ? <p className="w-full text-right text-xs text-red-300 sm:order-last">{reprocessError}</p> : null}
    </div>
  );
}
