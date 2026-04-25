import type { EventActivityRow } from "@/lib/store";

type EventActivityFeedProps = {
  items: EventActivityRow[];
};

export default function EventActivityFeed({ items }: EventActivityFeedProps) {
  return (
    <section className="rounded-2xl border border-brand-border bg-brand-surface/50 p-5">
      <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-gold-dim">Activity</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-brand-muted">No activity yet.</p>
      ) : (
        <ul className="mt-3 space-y-3 text-sm">
          {items.map((a) => (
            <li key={a.id} className="border-b border-white/5 pb-2 last:border-0">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="font-medium capitalize text-brand-gold-bright">{a.action.replace(/_/g, " ")}</span>
                <time className="text-xs text-brand-muted">{new Date(a.created_at).toLocaleString()}</time>
              </div>
              {a.actor_label ? <p className="text-xs text-brand-muted">By {a.actor_label}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
