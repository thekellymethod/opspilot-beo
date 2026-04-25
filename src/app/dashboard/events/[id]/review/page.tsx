import { redirect, notFound } from "next/navigation";
import { getEvent, listEventVersions } from "@/lib/store";

type PageProps = {
  params: Promise<{ id: string }>;
};

/** Legacy URL → canonical version-scoped review route. */
export default async function LegacyManagerReviewRedirect({ params }: PageProps) {
  const { id: eventId } = await params;
  const event = await getEvent(eventId);
  if (!event) notFound();
  const versions = await listEventVersions(eventId);
  const v = versions[0];
  if (!v) {
    redirect(`/dashboard/events/${eventId}/command`);
  }
  redirect(`/dashboard/events/${eventId}/versions/${v.id}/review`);
}
