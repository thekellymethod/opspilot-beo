import { NextResponse } from "next/server";
import { getPinnedOrLatestVersion, listEventConfirmations } from "@/lib/store";
import type { Department } from "@/lib/types";

const REQUIRED_DEPARTMENTS: Department[] = [
  "management",
  "banquets",
  "kitchen",
  "bar",
  "engineering",
  "housekeeping",
  "security",
  "front_office",
];

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const version = await getPinnedOrLatestVersion(id);
  if (!version) return NextResponse.json({ error: "Event/version not found." }, { status: 404 });

  const confirmations = await listEventConfirmations(id);
  const pinned = confirmations.filter((row) => row.version_id === version.id && row.scope === "final_signoff");
  const unmet = REQUIRED_DEPARTMENTS.filter(
    (department) => !pinned.some((row) => row.department === department && row.required && row.acknowledged),
  );

  if (unmet.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "Final sign-off blocked.",
        unmetRequirements: unmet,
      },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, status: "operationally_confirmed", versionId: version.id });
}
