import Link from "next/link";

export default function EventBriefingNotFound() {
  return (
    <div className="min-h-screen bg-brand-night bg-gradient-to-b from-brand-navy/90 to-brand-night text-brand-champagne">
      <div className="mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center">
        <div className="rounded-full border border-brand-border bg-brand-gold/10 px-4 py-1 text-xs uppercase tracking-[0.18em] text-brand-gold">
          Event briefing
        </div>
        <h1 className="font-display mt-6 text-3xl font-semibold tracking-tight text-brand-champagne">
          Event briefing not found
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-7 text-brand-muted">
          The requested event could not be loaded or does not exist in the current environment.
        </p>
        <Link
          href="/dashboard/events"
          className="mt-8 rounded-xl border border-brand-gold/40 bg-brand-gold/15 px-5 py-2.5 text-sm font-semibold text-brand-gold-bright transition hover:bg-brand-gold/25"
        >
          Return to events
        </Link>
      </div>
    </div>
  );
}
