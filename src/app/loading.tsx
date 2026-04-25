export default function AppLoading() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-5 py-10 sm:px-8">
      <div className="h-48 animate-pulse rounded-3xl bg-white/5" aria-hidden />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="h-64 animate-pulse rounded-2xl bg-white/5 lg:col-span-2" aria-hidden />
        <div className="h-40 animate-pulse rounded-2xl bg-white/5" aria-hidden />
      </div>
      <p className="sr-only">Loading…</p>
    </div>
  );
}
