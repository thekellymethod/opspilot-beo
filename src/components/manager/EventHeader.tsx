import Link from "next/link";
import type { EventReadinessSnapshot } from "@/lib/types";

type EventHeaderProps = {
  eventName: string;
  eventDate: string;
  roomName?: string | null;
  readiness: EventReadinessSnapshot;
};

function readinessBadgeClass(level: EventReadinessSnapshot["level"]) {
  switch (level) {
    case "ready":
      return "border-emerald-400/50 bg-emerald-500/15 text-emerald-100";
    case "attention":
      return "border-amber-400/50 bg-amber-500/15 text-amber-50";
    default:
      return "border-red-400/50 bg-red-500/15 text-red-50";
  }
}

export default function EventHeader({ eventName, eventDate, roomName, readiness }: EventHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-brand-border/80 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <Link
          href="/"
          className="inline-block text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-gold-dim transition hover:text-brand-gold-bright hover:underline"
        >
          ← Command center
        </Link>
        <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight text-brand-champagne">{eventName}</h1>
        <p className="mt-1 text-sm text-brand-muted">
          {eventDate}
          {roomName ? ` · ${roomName}` : ""}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div
          className={`rounded-2xl border px-4 py-3 text-center ${readinessBadgeClass(readiness.level)}`}
          title={readiness.reasons.join(" · ")}
        >
          <div className="text-[10px] font-semibold uppercase tracking-wider opacity-80">Readiness</div>
          <div className="font-display text-3xl font-bold leading-none">{readiness.score}</div>
          <div className="mt-1 text-[11px] capitalize opacity-90">{readiness.level}</div>
        </div>
      </div>
    </header>
  );
}
