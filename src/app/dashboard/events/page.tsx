import Link from "next/link";
import { listUpcomingEvents } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function DashboardEventsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const events = await listUpcomingEvents(today, 45);
  const headline = new Date(today + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <main className="relative flex-1 px-5 py-8 sm:px-8 lg:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="relative overflow-hidden rounded-3xl border border-brand-border bg-gradient-to-br from-brand-surface via-brand-navy/95 to-brand-burgundy/25 p-8 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.55)] sm:p-10">
          <div
            className="pointer-events-none absolute right-0 top-0 h-48 w-48 translate-x-1/4 -translate-y-1/4 rounded-full bg-brand-gold/15 blur-2xl"
            aria-hidden
          />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-brand-gold">Events dashboard</p>
              <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight text-brand-champagne sm:text-4xl">
                Upcoming on property
              </h1>
              <p className="mt-2 max-w-xl text-sm text-brand-muted">{headline} + next 45 days</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <div className="rounded-2xl border border-brand-border bg-brand-night/40 px-5 py-3 text-center backdrop-blur-sm">
                <p className="font-display text-2xl font-semibold text-brand-gold-bright">{events.length}</p>
                <p className="text-[10px] font-medium uppercase tracking-wider text-brand-muted">Events</p>
              </div>
              <Link
                href="/upload"
                className="inline-flex items-center justify-center self-end rounded-2xl border border-brand-gold/40 bg-brand-gold/15 px-5 py-3 text-sm font-semibold text-brand-gold-bright shadow-[0_0_28px_-8px_rgba(201,168,76,0.4)] transition hover:bg-brand-gold/25"
              >
                + BEO intake
              </Link>
            </div>
          </div>
        </header>

        {events.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-brand-border/80 bg-brand-surface/40 p-12 text-center">
            <p className="font-display text-lg text-brand-champagne">No upcoming events found</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-brand-muted">
              Promote a parsed BEO or connect Supabase so events appear here. In development, mock briefings may still
              load for unknown IDs when enabled.
            </p>
            <Link
              href="/upload"
              className="mt-6 inline-flex rounded-xl border border-brand-gold/40 bg-brand-gold/10 px-5 py-2.5 text-sm font-semibold text-brand-gold-bright transition hover:bg-brand-gold/20"
            >
              Go to intake
            </Link>
          </div>
        ) : (
          <ul className="mt-10 grid gap-4 sm:grid-cols-2">
            {events.map((event) => (
              <li key={event.id}>
                <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-brand-border/70 bg-brand-surface/55 shadow-[0_12px_40px_-20px_rgba(0,0,0,0.5)] transition hover:border-brand-gold/35 hover:bg-brand-elevated/60 hover:shadow-[0_16px_48px_-16px_rgba(201,168,76,0.12)]">
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-gold/50 to-transparent opacity-0 transition group-hover:opacity-100" />
                  <div className="flex flex-1 flex-col p-6">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="font-display text-lg font-semibold leading-snug text-brand-champagne">
                        {event.event_name}
                      </h2>
                      <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-muted">
                        {event.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-brand-muted">{event.room_name}</p>
                    <p className="mt-1 text-xs text-brand-gold-dim">{event.event_date}</p>
                    <div className="mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-5">
                      <Link
                        href={`/events/${event.id}`}
                        className="rounded-lg border border-white/12 px-3 py-2 text-xs font-medium text-brand-champagne/90 transition hover:border-brand-border hover:bg-white/5"
                      >
                        Event detail
                      </Link>
                      <Link
                        href={`/dashboard/events/${event.id}/command`}
                        className="rounded-lg border border-brand-burgundy/40 bg-brand-burgundy/15 px-3 py-2 text-xs font-semibold text-brand-champagne transition hover:bg-brand-burgundy/25"
                      >
                        Command
                      </Link>
                      <Link
                        href={`/dashboard/events/${event.id}/review`}
                        className="rounded-lg border border-white/12 px-3 py-2 text-xs font-medium text-brand-champagne/90 transition hover:border-brand-border hover:bg-white/5"
                      >
                        Review
                      </Link>
                      <Link
                        href={`/dashboard/events/${event.id}/briefing`}
                        className="rounded-lg border border-brand-gold/40 bg-brand-gold/12 px-3 py-2 text-xs font-semibold text-brand-gold-bright transition hover:bg-brand-gold/22"
                      >
                        Server briefing
                      </Link>
                      <Link
                        href={`/events/${event.id}/briefing`}
                        className="rounded-lg px-3 py-2 text-xs text-brand-muted transition hover:text-brand-champagne"
                      >
                        Client briefing
                      </Link>
                    </div>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-10 text-center text-[11px] text-brand-muted">
          Server-rendered briefing:{" "}
          <code className="rounded bg-brand-night/80 px-1.5 py-0.5 text-brand-gold-dim">/dashboard/events/[id]/briefing</code>
        </p>
      </div>
    </main>
  );
}
