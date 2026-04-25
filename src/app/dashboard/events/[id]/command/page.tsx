import Link from "next/link";
import { notFound } from "next/navigation";
import CommandToolbar from "@/components/manager/CommandToolbar";
import DepartmentStatusGrid from "@/components/manager/DepartmentStatusGrid";
import EventActivityFeed from "@/components/manager/EventActivityFeed";
import EventBriefingShell from "@/components/manager/EventBriefingShell";
import EventHeader from "@/components/manager/EventHeader";
import RevisionBanner from "@/components/manager/RevisionBanner";
import TaskSummaryPanel from "@/components/manager/TaskSummaryPanel";
import { getEventCommandData } from "@/lib/manager/getEventCommandData";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EventCommandPage({ params }: PageProps) {
  const { id: eventId } = await params;
  const data = await getEventCommandData(eventId);
  if (!data) notFound();

  const { event, briefing, operationalChanges, tasks, activity, readiness, departmentRows, pinnedVersionId, reviewHref } =
    data;

  return (
    <main className="flex-1 px-5 py-8 text-brand-champagne sm:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <EventHeader
            eventName={event.event_name}
            eventDate={event.event_date}
            roomName={event.room_name}
            readiness={readiness}
          />
          <CommandToolbar
            eventId={eventId}
            pinnedVersionId={pinnedVersionId}
            reviewHref={reviewHref}
            briefingHref={`/dashboard/events/${eventId}/briefing`}
          />
        </div>

        {readiness.reasons.length > 0 ? (
          <section className="rounded-xl border border-white/10 bg-brand-night/40 px-4 py-3 text-sm text-brand-champagne/85">
            <span className="font-semibold text-brand-gold-dim">Readiness notes: </span>
            {readiness.reasons.join(" · ")}
          </section>
        ) : null}

        {briefing ? (
          <p className="text-xs text-brand-muted">
            Briefing from version <span className="text-brand-champagne">v{briefing.trace.versionNumber}</span> ·{" "}
            {new Date(briefing.trace.briefingCreatedAt).toLocaleString()}
            {briefing.trace.promotedBy ? (
              <>
                {" "}
                · promoted by {briefing.trace.promotedBy}
              </>
            ) : null}
          </p>
        ) : null}

        <RevisionBanner changes={operationalChanges} />

        <EventBriefingShell briefing={briefing?.briefingDoc ?? null} location={briefing?.briefingLocation ?? null} />

        <DepartmentStatusGrid rows={departmentRows} />

        <TaskSummaryPanel tasks={tasks} />

        <EventActivityFeed items={activity} />

        {briefing ? (
          <p className="text-center text-xs text-brand-muted">
            <Link href={reviewHref} className="text-brand-gold-bright hover:underline">
              Open version review
            </Link>
          </p>
        ) : (
          <p className="text-center text-sm text-brand-muted">
            <Link href={reviewHref} className="font-medium text-brand-gold-bright hover:underline">
              Go to review to promote a version
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
