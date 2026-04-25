import { NextResponse } from "next/server";
import { assignStaffToEvent, removeStaffAssignmentFromEvent } from "@/lib/store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { staffRosterId?: string };
    if (!body.staffRosterId) {
      return NextResponse.json({ error: "staffRosterId is required." }, { status: 400 });
    }
    const assignment = await assignStaffToEvent(id, body.staffRosterId);
    return NextResponse.json({ assignment });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to assign staff to event.", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { staffRosterId?: string };
    if (!body.staffRosterId) {
      return NextResponse.json({ error: "staffRosterId is required." }, { status: 400 });
    }
    await removeStaffAssignmentFromEvent(id, body.staffRosterId);
    return NextResponse.json({ removed: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to remove staff assignment.", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
