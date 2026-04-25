import { NextResponse } from "next/server";
import { saveEventChangeView } from "@/lib/store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { title?: string; summary?: string };
    const title = body.title?.trim() ?? "";
    const summary = body.summary?.trim() ?? "";
    if (!title || !summary) {
      return NextResponse.json({ error: "title and summary are required." }, { status: 400 });
    }
    const saved = await saveEventChangeView(id, title, summary);
    return NextResponse.json({ saved });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to save final change view.", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
