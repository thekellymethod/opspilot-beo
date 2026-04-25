import { NextRequest, NextResponse } from "next/server";
import { requireManagerUser } from "@/lib/auth/requireManager";
import { PromoteApprovedVersionError } from "@/lib/beo/promoteApprovedVersion";
import { runPromoteEventVersion } from "@/lib/beo/runPromoteEventVersion";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string; versionId: string }> },
) {
  const auth = await requireManagerUser();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  const { id: eventId, versionId } = await context.params;
  const approvedBy = auth.user.email ?? auth.user.id;

  try {
    const result = await runPromoteEventVersion({
      eventId,
      versionId,
      approvedBy,
    });

    return NextResponse.json({
      ok: true,
      briefing: result.briefing,
      tasks: result.tasks,
      changes: result.changes,
      version: result.version,
    });
  } catch (e) {
    if (e instanceof PromoteApprovedVersionError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }
    const message = e instanceof Error ? e.message : "Promotion failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
