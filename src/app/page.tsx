import Link from "next/link";
import { listEventsForDate } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function CommandCenterPage() {
  const today = new Date().toISOString().slice(0, 10);
  const events = await listEventsForDate(today);
  const formatted = new Date(today + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-10 sm:px-8">
      <div className="relative overflow-hidden rounded-3xl border border-brand-border bg-gradient-to-br from-brand-surface/95 via-brand-navy/90 to-brand-burgundy/20 p-8 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.6)] sm:p-10">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand-gold/10 blur-3xl"
          aria-hidden
        />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-gold">Marriott-inspired operations</p>
          <h1 className="font-display mt-3 text-3xl font-semibold tracking-tight text-brand-champagne sm:text-4xl">
            Command center
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-brand-muted sm:text-base">
            One glance at today&apos;s house: event roster, briefings, and intake — styled for high-profile banquet and
            catering leadership.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/dashboard/events"
              className="inline-flex items-center justify-center rounded-xl border border-brand-gold/40 bg-brand-gold/15 px-5 py-2.5 text-sm font-semibold text-brand-gold-bright shadow-[0_0_32px_-10px_rgba(201,168,76,0.45)] transition hover:bg-brand-gold/25"
            >
              Open events dashboard
            </Link>
            <Link
              href="/upload"
              className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-brand-champagne transition hover:border-brand-border hover:bg-white/10"
            >
              New BEO intake
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-brand-border/80 bg-brand-surface/60 p-6 backdrop-blur-sm lg:col-span-2">
          <div className="flex items-end justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-brand-champagne">Today&apos;s events</h2>
              <p className="mt-1 text-xs text-brand-muted">{formatted}</p>
            </div>
            <span className="rounded-full border border-brand-gold/25 bg-brand-gold/10 px-3 py-1 text-xs font-medium text-brand-gold-bright">
              {events.length} on calendar
            </span>
          </div>
          {events.length === 0 ? (
            <p className="mt-6 text-sm text-brand-muted">
              No events for this date.{" "}
              <Link href="/upload" className="font-medium text-brand-gold-bright underline-offset-2 hover:underline">
                Upload a BEO
              </Link>{" "}
              to create the first version.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-white/10">
              {events.map((event) => (
                <li key={event.id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0">
                  <div>
                    <p className="font-medium text-brand-champagne">{event.event_name}</p>
                    <p className="mt-0.5 text-xs text-brand-muted">
                      {event.room_name} · <span className="capitalize">{event.status}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/events/${event.id}`}
                      className="rounded-lg border border-white/12 px-3 py-1.5 text-xs font-medium text-brand-champagne/90 transition hover:border-brand-border hover:bg-white/5"
                    >
                      Detail
                    </Link>
                    <Link
                      href={`/dashboard/events/${event.id}/briefing`}
                      className="rounded-lg border border-brand-gold/35 bg-brand-gold/10 px-3 py-1.5 text-xs font-semibold text-brand-gold-bright transition hover:bg-brand-gold/20"
                    >
                      Briefing
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border border-brand-burgundy/35 bg-brand-burgundy/15 p-6">
            <h3 className="font-display text-base font-semibold text-brand-champagne">Service standards</h3>
            <p className="mt-2 text-xs leading-relaxed text-brand-champagne/75">
              Briefings compress risk, change, and department notes. Acknowledgments and print views support pre-shift
              lineups.
            </p>
          </div>
          <div className="rounded-2xl border border-brand-border/60 bg-brand-surface/50 p-6">
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-gold-dim">Quick paths</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/dashboard/events" className="text-brand-gold-bright hover:underline">
                  Full events dashboard →
                </Link>
              </li>
              <li>
                <Link href="/upload" className="text-brand-muted hover:text-brand-champagne">
                  Pipeline intake →
                </Link>
              </li>
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}
