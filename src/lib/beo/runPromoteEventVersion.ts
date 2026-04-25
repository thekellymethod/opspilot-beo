import { revalidatePath } from "next/cache";
import {
  PromoteApprovedVersionError,
  promoteApprovedVersion,
  type PromoteApprovedVersionResult,
} from "@/lib/beo/promoteApprovedVersion";
import { computeAndPersistReadiness } from "@/lib/beo/readiness";

export function revalidateEventManagerSurfaces(eventId: string, versionId?: string) {
  revalidatePath("/dashboard/events");
  revalidatePath(`/dashboard/events/${eventId}`);
  revalidatePath(`/dashboard/events/${eventId}/briefing`);
  revalidatePath(`/dashboard/events/${eventId}/command`);
  revalidatePath(`/dashboard/events/${eventId}/review`);
  if (versionId) {
    revalidatePath(`/dashboard/events/${eventId}/versions/${versionId}/review`);
  }
}

export async function runPromoteEventVersion(input: {
  eventId: string;
  versionId: string;
  approvedBy: string;
}): Promise<PromoteApprovedVersionResult> {
  const result = await promoteApprovedVersion({
    eventId: input.eventId,
    versionId: input.versionId,
    approvedBy: input.approvedBy,
  });
  await computeAndPersistReadiness(input.eventId);
  revalidateEventManagerSurfaces(input.eventId, input.versionId);
  return result;
}
