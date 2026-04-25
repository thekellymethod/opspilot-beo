import type { DepartmentCommandRow } from "@/lib/manager/getEventCommandData";

type DepartmentStatusGridProps = {
  rows: DepartmentCommandRow[];
};

export default function DepartmentStatusGrid({ rows }: DepartmentStatusGridProps) {
  if (!rows.length) {
    return (
      <section className="rounded-2xl border border-brand-border bg-brand-surface/50 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-gold-dim">Departments</h2>
        <p className="mt-3 text-sm text-brand-muted">No department rows yet.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-brand-border bg-brand-surface/50 p-5">
      <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-gold-dim">Department status</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => (
          <article
            key={row.department}
            className="rounded-xl border border-white/10 bg-brand-night/40 px-4 py-3 capitalize"
          >
            <h3 className="font-semibold text-brand-champagne">{row.department}</h3>
            <p className="mt-2 text-xs text-brand-muted">
              Acknowledged:{" "}
              <span className={row.acknowledged ? "font-medium text-emerald-300" : "text-amber-200/90"}>
                {row.acknowledged ? "Yes" : "No"}
              </span>
            </p>
            {row.acknowledgedAt ? (
              <p className="text-[11px] text-brand-muted">{new Date(row.acknowledgedAt).toLocaleString()}</p>
            ) : null}
            <p className="mt-2 text-sm text-brand-champagne">
              Tasks:{" "}
              <span className="font-medium text-emerald-200/90">{row.taskCompleted}</span>
              <span className="text-brand-muted"> / </span>
              <span>{row.taskTotal}</span>
              <span className="text-brand-muted"> done</span>
            </p>
            {row.criticalOpenTitles.length > 0 ? (
              <p className="mt-2 text-[11px] leading-snug text-red-200/95">
                Critical: {row.criticalOpenTitles.join(" · ")}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
