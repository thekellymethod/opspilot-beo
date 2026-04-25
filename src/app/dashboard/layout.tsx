import Link from "next/link";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-gradient-to-b from-brand-navy/90 via-brand-night/95 to-brand-burgundy/10 lg:flex-row">
      <aside className="shrink-0 border-b border-brand-burgundy/20 bg-gradient-to-br from-brand-navy/55 via-brand-navy/45 to-brand-burgundy/15 px-5 py-4 backdrop-blur-sm lg:w-56 lg:border-b-0 lg:border-r lg:border-r-brand-burgundy/30 lg:py-8">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold-dim">Operations</p>
        <nav className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
          <Link
            href="/dashboard/events"
            className="rounded-lg border border-transparent px-3 py-2 text-sm text-brand-champagne/90 transition hover:border-brand-border hover:bg-white/5"
          >
            Today&apos;s events
          </Link>
          <a
            href="/"
            className="rounded-lg border border-transparent px-3 py-2 text-sm text-brand-muted transition hover:border-brand-border hover:bg-white/5 hover:text-brand-champagne"
          >
            Command center
          </a>
          <Link
            href="/upload"
            className="rounded-lg border border-transparent px-3 py-2 text-sm text-brand-muted transition hover:border-brand-border hover:bg-white/5 hover:text-brand-champagne"
          >
            BEO intake
          </Link>
          <Link
            href="/dashboard/staff"
            className="rounded-lg border border-transparent px-3 py-2 text-sm text-brand-muted transition hover:border-brand-border hover:bg-white/5 hover:text-brand-champagne"
          >
            Staff roster
          </Link>
        </nav>
        <div className="mt-6 hidden lg:block">
          <div className="h-px w-full bg-gradient-to-r from-brand-gold/40 via-brand-burgundy/30 to-transparent" />
          <p className="mt-4 text-xs leading-relaxed text-brand-muted">
            Briefings reflect the latest promoted BEO version. Use Intake for new files.
          </p>
        </div>
      </aside>
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
