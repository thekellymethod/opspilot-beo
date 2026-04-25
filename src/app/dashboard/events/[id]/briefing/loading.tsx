export default function LoadingEventBriefingPage() {
  return (
    <div className="min-h-screen bg-brand-night bg-gradient-to-b from-brand-navy/80 to-brand-night text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 animate-pulse rounded-[28px] border border-brand-border/60 bg-brand-surface/40 p-6">
          <div className="h-4 w-28 rounded bg-brand-gold/20" />
          <div className="mt-4 h-8 max-w-2xl rounded bg-white/10" />
          <div className="mt-3 h-4 max-w-md rounded bg-white/10" />
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="h-16 rounded-xl bg-white/10" />
            <div className="h-16 rounded-xl bg-white/10" />
            <div className="h-16 rounded-xl bg-white/10" />
            <div className="h-16 rounded-xl bg-white/10" />
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
          <div className="space-y-6">
            <div className="h-48 animate-pulse rounded-2xl border border-brand-border/50 bg-brand-surface/30" />
            <div className="h-72 animate-pulse rounded-2xl border border-brand-border/50 bg-brand-surface/30" />
            <div className="h-80 animate-pulse rounded-2xl border border-brand-border/50 bg-brand-surface/30" />
          </div>
          <div className="space-y-6">
            <div className="h-64 animate-pulse rounded-2xl border border-brand-border/50 bg-brand-surface/30" />
            <div className="h-64 animate-pulse rounded-2xl border border-brand-border/50 bg-brand-surface/30" />
            <div className="h-48 animate-pulse rounded-2xl border border-brand-border/50 bg-brand-surface/30" />
          </div>
        </div>
      </div>
    </div>
  );
}
