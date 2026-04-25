import type { EventBriefing } from "@/lib/beo/briefingGenerator";

type EventBriefingShellProps = {
  briefing: EventBriefing | null;
  location?: string | null;
  emptyMessage?: string;
};

export default function EventBriefingShell({
  briefing,
  location,
  emptyMessage = "No promoted briefing yet. Approve a version from review to publish operational context here.",
}: EventBriefingShellProps) {
  if (!briefing) {
    return (
      <section className="rounded-2xl border border-dashed border-brand-border/80 bg-brand-surface/40 p-10 text-center">
        <p className="text-sm text-brand-muted">{emptyMessage}</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-brand-border bg-brand-surface/55 p-6">
      <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-gold-dim">Briefing</h2>
      {location ? <p className="mt-2 text-sm text-brand-muted">{location}</p> : null}
      <h3 className="font-display mt-4 text-xl font-semibold text-brand-champagne">{briefing.headline}</h3>
      {briefing.summary ? <p className="mt-2 text-sm leading-relaxed text-brand-champagne/85">{briefing.summary}</p> : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Key facts</h4>
          <ul className="mt-2 space-y-1.5 text-sm text-brand-champagne/90">
            {briefing.keyFacts.slice(0, 8).map((line, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-brand-gold-dim">·</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Timeline</h4>
          <ul className="mt-2 space-y-1.5 text-sm text-brand-champagne/90">
            {briefing.timeline.slice(0, 8).map((line, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-brand-gold-dim">·</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {briefing.risks.length > 0 ? (
        <div className="mt-6">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-red-200/90">Risks</h4>
          <ul className="mt-2 space-y-2">
            {briefing.risks.map((risk, i) => (
              <li
                key={i}
                className="rounded-xl border border-red-400/30 bg-red-950/35 px-3 py-2 text-sm text-red-50/95"
              >
                {risk}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
