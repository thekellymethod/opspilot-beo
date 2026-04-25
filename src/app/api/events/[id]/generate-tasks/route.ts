import { NextResponse } from "next/server";
import { generateTasks } from "@/lib/beo/taskGenerator";
import { generatedTasksToEventTaskRecords } from "@/lib/beo/mapToPersistence";
import type { GeneratedTask } from "@/lib/beo/taskGenerator";
import { parsedBEOToNormalized } from "@/lib/beo/parsedBEOToNormalized";
import { loadPropertyProfile } from "@/lib/beo/propertyProfile";
import type { NormalizedBeoRecord } from "@/lib/beo/types";
import { getEvent, getLatestVersion, replaceTasks } from "@/lib/store";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const latestVersion = await getLatestVersion(id);
    if (!latestVersion) {
      return NextResponse.json({ error: "Event version not found" }, { status: 404 });
    }

    const normalized =
      (latestVersion.normalized_json as NormalizedBeoRecord | undefined) ?? parsedBEOToNormalized(latestVersion.parsed_json);

    const generated = generateTasks(normalized, { eventId: id });
    const event = await getEvent(id);
    const staffing = loadPropertyProfile(event?.property_id ?? null).staffing_capacity ?? { servers: 0, bartenders: 0, kitchen: 0 };
    const needed = {
      servers: normalized.guaranteedGuests ? Math.max(0, Math.ceil(normalized.guaranteedGuests / 20)) : 0,
      bartenders: normalized.serviceStyle === "reception" || normalized.serviceStyle === "beverage_only" ? 2 : 1,
      kitchen: normalized.guaranteedGuests && normalized.guaranteedGuests > 0 ? 1 : 0,
    };

    const shortages: string[] = [];
    if (needed.servers > staffing.servers) shortages.push(`servers short by ${needed.servers - staffing.servers}`);
    if (needed.bartenders > staffing.bartenders) shortages.push(`bartenders short by ${needed.bartenders - staffing.bartenders}`);
    if (needed.kitchen > staffing.kitchen) shortages.push(`kitchen short by ${needed.kitchen - staffing.kitchen}`);

    if (shortages.length > 0) {
      const staffingTask: GeneratedTask = {
        id: `${id}_management_staffing_gap`,
        department: "management",
        title: "Resolve staffing shortfall",
        description: "Current staffing availability cannot fully cover event requirements.",
        dueAt: normalized.staffCallTime ?? normalized.setupStart ?? null,
        priority: "critical",
        checklist: [
          `Required staffing: servers ${needed.servers}, bartenders ${needed.bartenders}, kitchen ${needed.kitchen}`,
          `Available staffing: servers ${staffing.servers}, bartenders ${staffing.bartenders}, kitchen ${staffing.kitchen}`,
          ...shortages,
          "Escalate coverage request or adjust service plan before execution.",
        ],
        tags: ["staffing", "coverage", "critical"],
        sourceRule: "staffing_capacity_gap_rule",
      };
      generated.push(staffingTask);
    }

    const tasks = generatedTasksToEventTaskRecords(id, generated);
    const savedTasks = await replaceTasks(id, tasks);
    return NextResponse.json({ tasks: savedTasks, generated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown task generation error";
    return NextResponse.json({ error: "Failed to generate tasks", details: message }, { status: 500 });
  }
}
