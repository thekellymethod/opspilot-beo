import { NextResponse } from "next/server";
import { insertEventManagerNote, listEventManagerNotes } from "@/lib/store";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const notes = await listEventManagerNotes(id);
  return NextResponse.json({ notes });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    body?: string;
    section?: string;
    flagged?: boolean;
    createdBy?: string | null;
  };
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }
  const section = typeof body.section === "string" && body.section.trim() ? body.section.trim() : "general";
  const flagged = Boolean(body.flagged);
  const createdBy = body.createdBy ?? "manager";

  const note = await insertEventManagerNote({
    event_id: id,
    section,
    body: text,
    flagged,
    created_by: createdBy,
  });
  return NextResponse.json({ ok: true, note });
}
