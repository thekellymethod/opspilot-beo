import { NextResponse } from "next/server";
import { getPinnedOrLatestVersion, listEventConfirmations, upsertEventConfirmation } from "@/lib/store";
import type { Department } from "@/lib/types";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const confirmations = await listEventConfirmations(id);
  return NextResponse.json({ confirmations });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    department?: Department;
    scope?: "briefing" | "ops_plan" | "final_signoff";
    acknowledged?: boolean;
    acknowledgedBy?: string | null;
    required?: boolean;
    note?: string | null;
  };

  if (!body.department) return NextResponse.json({ error: "department is required" }, { status: 400 });
  const version = await getPinnedOrLatestVersion(id);
  if (!version) return NextResponse.json({ error: "Event version not found." }, { status: 404 });

  const ack = Boolean(body.acknowledged);
  const row = await upsertEventConfirmation({
    event_id: id,
    version_id: version.id,
    department: body.department,
    scope: body.scope ?? "ops_plan",
    required: body.required ?? true,
    acknowledged: ack,
    acknowledged_at: ack ? new Date().toISOString() : null,
    acknowledged_by: ack ? body.acknowledgedBy ?? "manager" : null,
    note: body.note ?? null,
  });

  return NextResponse.json({ ok: true, confirmation: row });
}
