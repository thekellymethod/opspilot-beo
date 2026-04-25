import Link from "next/link";
import { notFound } from "next/navigation";
import EventBriefingPage from "@/components/beo/EventBriefingPage";
import type { BriefingLevel } from "@/lib/beo/briefingGenerator";
import { loadEventBriefing } from "@/lib/beo/loadEventBriefing";

const LEVELS: BriefingLevel[] = ["executive", "management", "department"];

type PageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{ level?: string }>;
};

export default async function EventBriefingRoutePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const levelParam = sp.level;
  const level: BriefingLevel | undefined = LEVELS.includes(levelParam as BriefingLevel)
    ? (levelParam as BriefingLevel)
    : undefined;

  const data = await loadEventBriefing(id, { level });

  if (!data) {
    notFound();
  }

  const activeLevel = level ?? "management";

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-brand-border bg-brand-navy/90 print:hidden">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Link href={`/dashboard/events`} className="font-medium text-brand-gold-bright hover:text-brand-champagne">
              ← Events
            </Link>
            <span className="text-brand-muted/50">|</span>
            <span className="text-brand-muted">Briefing depth</span>
            <nav className="flex flex-wrap gap-1 rounded-xl border border-brand-border/80 bg-brand-surface/60 p-0.5">
              {LEVELS.map((l) => (
                <Link
                  key={l}
                  href={l === "management" ? `/dashboard/events/${id}/briefing` : `/dashboard/events/${id}/briefing?level=${l}`}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition ${
                    activeLevel === l
                      ? "bg-brand-gold/25 text-brand-champagne shadow-[0_0_16px_-6px_rgba(201,168,76,0.35)]"
                      : "text-brand-muted hover:text-brand-gold-bright"
                  }`}
                >
                  {l}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>

      <EventBriefingPage
        briefing={data.briefing}
        eventDate={data.eventDate}
        location={data.location}
        status={data.status}
        operationalChanges={data.operationalChanges}
        validation={data.validation}
        versionMeta={data.versionMeta}
      />
    </div>
  );
}
