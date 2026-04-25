import { NextResponse } from "next/server";
import { deleteStaffRosterEntry, insertStaffRoster, listStaffRosterForDate, updateStaffRosterAvailability } from "@/lib/store";
import type { Department } from "@/lib/types";

type IncomingRosterRow = {
  property_id?: string | null;
  staff_name?: string;
  department?: Department;
  role?: string | null;
  shift_date?: string;
  available?: boolean;
};

function isDepartment(value: unknown): value is Department {
  return (
    value === "banquets" ||
    value === "bar" ||
    value === "kitchen" ||
    value === "management" ||
    value === "setup" ||
    value === "av" ||
    value === "engineering" ||
    value === "housekeeping" ||
    value === "security" ||
    value === "front_office"
  );
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const date = params.get("date") ?? new Date().toISOString().slice(0, 10);
  const propertyId = params.get("property_id");
  const includeUnavailable = params.get("include_unavailable") === "1";
  const rows = await listStaffRosterForDate(date, propertyId, { includeUnavailable });
  return NextResponse.json({ date, staff: rows });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      entries?: IncomingRosterRow[];
    };
    const entries = Array.isArray(body.entries) ? body.entries : [];
    if (entries.length === 0) {
      return NextResponse.json({ error: "No roster entries provided." }, { status: 400 });
    }

    const normalized = entries
      .map((row) => ({
        property_id: row.property_id ?? null,
        staff_name: row.staff_name?.trim() ?? "",
        department: row.department,
        role: row.role ?? null,
        shift_date: row.shift_date ?? "",
        available: row.available ?? true,
      }))
      .filter(
        (row): row is { property_id: string | null; staff_name: string; department: Department; role: string | null; shift_date: string; available: boolean } =>
          Boolean(row.staff_name && row.shift_date && isDepartment(row.department)),
      );

    if (normalized.length === 0) {
      return NextResponse.json({ error: "Entries missing required fields (staff_name, department, shift_date)." }, { status: 400 });
    }

    const dates = Array.from(new Set(normalized.map((row) => row.shift_date)));
    const existingByDate = await Promise.all(
      dates.map(async (d) => ({
        date: d,
        rows: await listStaffRosterForDate(d, null, { includeUnavailable: true }),
      })),
    );

    const existingKeys = new Set<string>();
    for (const group of existingByDate) {
      for (const row of group.rows) {
        const key = [
          row.shift_date,
          row.property_id ?? "",
          row.department,
          row.staff_name.trim().toLowerCase(),
          (row.role ?? "").trim().toLowerCase(),
        ].join("|");
        existingKeys.add(key);
      }
    }

    const deduped: typeof normalized = [];
    const skipped: typeof normalized = [];
    for (const row of normalized) {
      const key = [
        row.shift_date,
        row.property_id ?? "",
        row.department,
        row.staff_name.trim().toLowerCase(),
        (row.role ?? "").trim().toLowerCase(),
      ].join("|");
      if (existingKeys.has(key)) {
        skipped.push(row);
        continue;
      }
      existingKeys.add(key);
      deduped.push(row);
    }

    const saved = await insertStaffRoster(deduped);
    return NextResponse.json({ saved, skippedCount: skipped.length });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to save staff roster.", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { id?: string; available?: boolean };
    if (!body.id || typeof body.available !== "boolean") {
      return NextResponse.json({ error: "Provide id and available boolean." }, { status: 400 });
    }
    const updated = await updateStaffRosterAvailability(body.id, body.available);
    if (!updated) {
      return NextResponse.json({ error: "Roster entry not found." }, { status: 404 });
    }
    return NextResponse.json({ updated });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update roster entry.", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { id?: string };
    if (!body.id) {
      return NextResponse.json({ error: "Provide id." }, { status: 400 });
    }
    const deleted = await deleteStaffRosterEntry(body.id);
    if (!deleted) {
      return NextResponse.json({ error: "Roster entry not found." }, { status: 404 });
    }
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete roster entry.", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
