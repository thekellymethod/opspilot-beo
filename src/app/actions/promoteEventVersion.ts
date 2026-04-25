"use server";

import { requireManagerUser } from "@/lib/auth/requireManager";
import {
  PromoteApprovedVersionError,
  type PromoteApprovedVersionResult,
} from "@/lib/beo/promoteApprovedVersion";
import { runPromoteEventVersion } from "@/lib/beo/runPromoteEventVersion";

export type PromoteEventVersionActionState =
  | { ok: true; result: PromoteApprovedVersionResult }
  | { ok: false; error: string; status: number };

export async function promoteEventVersionAction(
  eventId: string,
  versionId: string,
): Promise<PromoteEventVersionActionState> {
  const auth = await requireManagerUser();
  if (!auth.ok) {
    return { ok: false, error: auth.message, status: auth.status };
  }

  const approvedBy = auth.user.email ?? auth.user.id;

  try {
    const result = await runPromoteEventVersion({ eventId, versionId, approvedBy });
    return { ok: true, result };
  } catch (e) {
    if (e instanceof PromoteApprovedVersionError) {
      return { ok: false, error: e.message, status: e.status };
    }
    const message = e instanceof Error ? e.message : "Promotion failed.";
    return { ok: false, error: message, status: 500 };
  }
}
