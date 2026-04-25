import type { OperationalChange } from "@/lib/beo/changeDetector";

type RevisionBannerProps = {
  changes: OperationalChange[];
};

export default function RevisionBanner({ changes }: RevisionBannerProps) {
  if (!changes.length) return null;

  return (
    <section className="rounded-2xl border border-amber-400/25 bg-amber-950/20 px-4 py-4">
      <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200/90">Revision highlights</h2>
      <p className="mt-1 text-xs text-brand-muted">Changes introduced with the last promoted version.</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {changes.map((c) => (
          <li
            key={`${c.field}-${c.title}`}
            className="rounded-full border border-white/10 bg-brand-night/60 px-3 py-1.5 text-sm text-brand-champagne"
          >
            <span className="font-medium text-brand-gold-bright">{c.title}</span>
            {c.severity === "critical" || c.severity === "high" ? (
              <span className="ml-2 text-[10px] uppercase tracking-wide text-amber-200/90">({c.severity})</span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
