import type { NormalizedBeoRecord, Severity } from "@/lib/beo/types";

export type TaskDepartment =
  | "management"
  | "banquets"
  | "kitchen"
  | "bar"
  | "av"
  | "setup";

export type GeneratedTask = {
  id: string;
  department: TaskDepartment;
  title: string;
  description: string;
  dueAt: string | null;
  priority: Severity;
  checklist: string[];
  tags: string[];
  sourceRule: string;
};

type TaskContext = {
  eventId?: string;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function makeTaskId(department: TaskDepartment, title: string, context?: TaskContext): string {
  const base = slugify(title);
  return context?.eventId ? `${context.eventId}_${department}_${base}` : `${department}_${base}`;
}

function createTask(
  department: TaskDepartment,
  title: string,
  description: string,
  dueAt: string | null,
  priority: Severity,
  checklist: string[],
  tags: string[],
  sourceRule: string,
  context?: TaskContext,
): GeneratedTask {
  return {
    id: makeTaskId(department, title, context),
    department,
    title,
    description,
    dueAt,
    priority,
    checklist,
    tags,
    sourceRule,
  };
}

function getBestGuestCount(record: NormalizedBeoRecord): number | null {
  return record.guaranteedGuests ?? record.expectedGuests ?? null;
}

function hasBarSignal(record: NormalizedBeoRecord): boolean {
  const searchable = [
    ...record.specialRequests,
    ...record.staffingNotes,
    ...record.equipment.map((e) => e.name),
    ...record.menu.map((m) => `${m.course ?? ""} ${m.item ?? ""}`.trim()),
  ]
    .join(" ")
    .toLowerCase();

  return /\bbar\b|\bbartender\b|\bcocktail\b|\bbeer\b|\bwine\b|\bliquor\b/.test(searchable);
}

function hasAvSignal(record: NormalizedBeoRecord): boolean {
  return record.equipment.some((item) =>
    /\bmic\b|\bmicrophone\b|\bprojector\b|\bscreen\b|\bpodium\b|\bav\b|\bspeaker\b/i.test(item.name),
  );
}

function buildMenuSummary(record: NormalizedBeoRecord): string[] {
  return record.menu
    .filter((item) => item.item)
    .map((item) => {
      const countPrefix = item.count ? `${item.count}x ` : "";
      const coursePrefix = item.course ? `${item.course}: ` : "";
      return `${countPrefix}${coursePrefix}${item.item}`;
    });
}

function buildDietaryChecklist(record: NormalizedBeoRecord): string[] {
  return record.dietaryFlags.map(
    (flag) => `${flag.count} ${flag.type.replace(/_/g, " ")} meal(s) flagged`,
  );
}

function dedupeTasks(tasks: GeneratedTask[]): GeneratedTask[] {
  const seen = new Set<string>();
  return tasks.filter((task) => {
    const key = `${task.department}|${task.title.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function generateTasks(record: NormalizedBeoRecord, context?: TaskContext): GeneratedTask[] {
  const tasks: GeneratedTask[] = [];
  const guestCount = getBestGuestCount(record);
  const menuSummary = buildMenuSummary(record);
  const dietaryChecklist = buildDietaryChecklist(record);

  tasks.push(
    createTask(
      "management",
      "Review event readiness",
      "Verify timeline, guest count, service format, and unresolved issues before execution.",
      record.staffCallTime ?? record.setupStart ?? record.guestArrivalTime ?? null,
      "high",
      [
        record.eventName ? `Confirm event: ${record.eventName}` : "Confirm event identity",
        guestCount ? `Confirm guest count: ${guestCount}` : "Confirm guest count",
        record.roomName ? `Confirm room: ${record.roomName}` : "Confirm room assignment",
        record.serviceStyle !== "unknown"
          ? `Confirm service style: ${record.serviceStyle}`
          : "Confirm service style",
      ],
      ["readiness", "management"],
      "base_management_review",
      context,
    ),
  );

  if (record.roomName || record.roomSetupStyle !== "unknown" || guestCount !== null) {
    tasks.push(
      createTask(
        "setup",
        "Prepare room setup",
        "Configure event room layout and physical setup based on guest count and requested format.",
        record.setupStart ?? record.staffCallTime ?? null,
        "high",
        [
          record.roomName ? `Set room: ${record.roomName}` : "Verify assigned room",
          guestCount ? `Set for ${guestCount} guests` : "Confirm guest seating count",
          record.roomSetupStyle !== "unknown"
            ? `Arrange layout: ${record.roomSetupStyle.replace(/_/g, " ")}`
            : "Confirm room layout",
          "Inspect tables, chairs, and flow before guest arrival",
        ],
        ["setup", "room"],
        "room_setup_rule",
        context,
      ),
    );
  }

  if (record.specialRequests.length > 0) {
    tasks.push(
      createTask(
        "banquets",
        "Review special requests",
        "Confirm all special requests are acknowledged and assigned before service.",
        record.staffCallTime ?? record.guestArrivalTime ?? null,
        "high",
        record.specialRequests,
        ["special_requests"],
        "special_requests_rule",
        context,
      ),
    );
  }

  if (record.serviceStyle === "plated") {
    tasks.push(
      createTask(
        "kitchen",
        "Prepare plated service execution",
        "Coordinate plating, firing sequence, and timing for a plated event.",
        record.serviceStartTime ?? record.guestArrivalTime ?? null,
        "high",
        [
          guestCount ? `Prepare plated count for ${guestCount} guests` : "Confirm plated meal count",
          ...menuSummary,
          "Verify plating sequence with banquet captain",
          "Confirm hold/fire timing before guest arrival",
        ],
        ["service_style", "plated"],
        "service_style_plated_rule",
        context,
      ),
    );

    tasks.push(
      createTask(
        "banquets",
        "Stage plated service staff",
        "Prepare service team for synchronized plated meal delivery.",
        record.staffCallTime ?? record.guestArrivalTime ?? null,
        "high",
        [
          "Assign server sections",
          "Review firing cadence with kitchen",
          "Confirm captain coverage",
          guestCount && guestCount > 100
            ? "Verify additional service support for high guest count"
            : "Confirm service coverage",
        ],
        ["service", "banquets", "plated"],
        "banquet_plated_staffing_rule",
        context,
      ),
    );
  }

  if (record.serviceStyle === "buffet" || record.serviceStyle === "stations") {
    tasks.push(
      createTask(
        "kitchen",
        "Prepare buffet or station production",
        "Coordinate production volume, replenishment plan, and service flow.",
        record.serviceStartTime ?? record.guestArrivalTime ?? null,
        "high",
        [
          guestCount ? `Prepare volume for ${guestCount} guests` : "Confirm service volume",
          ...menuSummary,
          "Confirm replenishment plan",
          "Verify setup timing with banquet team",
        ],
        ["service_style", record.serviceStyle],
        "service_style_buffet_or_stations_rule",
        context,
      ),
    );

    tasks.push(
      createTask(
        "banquets",
        "Set buffet or station lines",
        "Prepare guest traffic flow and station presentation.",
        record.setupStart ?? record.guestArrivalTime ?? null,
        "high",
        [
          "Place buffet or station tables",
          "Confirm guest traffic flow",
          "Verify signage and utensils",
          "Coordinate replenishment access paths",
        ],
        ["banquets", record.serviceStyle],
        "banquet_buffet_station_rule",
        context,
      ),
    );
  }

  if (record.serviceStyle === "reception" || record.serviceStyle === "boxed_meal") {
    tasks.push(
      createTask(
        "banquets",
        "Prepare alternate service format",
        "Review logistics for reception-style or boxed meal execution.",
        record.setupStart ?? record.guestArrivalTime ?? null,
        "medium",
        [
          `Confirm service style: ${record.serviceStyle}`,
          guestCount ? `Confirm quantity for ${guestCount} guests` : "Confirm final quantity",
          "Verify service distribution method",
        ],
        ["service_style", record.serviceStyle],
        "alternate_service_rule",
        context,
      ),
    );
  }

  if (record.dietaryFlags.length > 0) {
    tasks.push(
      createTask(
        "kitchen",
        "Flag dietary and allergy meals",
        "Identify, label, and isolate dietary meals before service.",
        record.serviceStartTime ?? record.guestArrivalTime ?? null,
        record.dietaryFlags.some((flag) => flag.priority === "critical") ? "critical" : "high",
        [
          ...dietaryChecklist,
          "Label special meals clearly",
          "Separate allergy-sensitive plates from standard production",
        ],
        ["dietary", "allergy"],
        "dietary_kitchen_rule",
        context,
      ),
    );

    tasks.push(
      createTask(
        "banquets",
        "Confirm dietary meal handoff",
        "Coordinate service handoff for dietary and allergy meals to correct guests.",
        record.staffCallTime ?? record.guestArrivalTime ?? null,
        record.dietaryFlags.some((flag) => flag.priority === "critical") ? "critical" : "high",
        [
          ...dietaryChecklist,
          "Assign responsible captain or lead server",
          "Verify guest delivery before general service release",
        ],
        ["dietary", "service_handoff"],
        "dietary_banquets_rule",
        context,
      ),
    );
  }

  if (guestCount !== null) {
    if (guestCount >= 100) {
      tasks.push(
        createTask(
          "management",
          "Verify large-event staffing coverage",
          "Review whether staffing and setup are adequate for a large guest count.",
          record.staffCallTime ?? record.setupStart ?? null,
          "high",
          [
            `Guest count threshold triggered: ${guestCount}`,
            "Review server-to-guest coverage",
            "Review bartender coverage if applicable",
            "Confirm setup crew availability",
          ],
          ["staffing", "large_event"],
          "guest_count_100_plus_rule",
          context,
        ),
      );
    }

    if (guestCount >= 200) {
      tasks.push(
        createTask(
          "management",
          "Escalate very large-event readiness check",
          "Perform heightened operational review due to very large guest volume.",
          record.staffCallTime ?? record.setupStart ?? null,
          "critical",
          [
            `Very large event guest count: ${guestCount}`,
            "Confirm backup staffing options",
            "Confirm service pacing plan",
            "Confirm contingency response for delays",
          ],
          ["large_event", "escalation"],
          "guest_count_200_plus_rule",
          context,
        ),
      );
    }
  }

  if (hasBarSignal(record)) {
    tasks.push(
      createTask(
        "bar",
        "Prepare bar service",
        "Review inventory, staffing, and setup requirements for beverage service.",
        record.setupStart ?? record.guestArrivalTime ?? null,
        "medium",
        [
          "Confirm bartender coverage",
          "Verify ice, mixers, glassware, and inventory",
          "Confirm bar setup location and timing",
        ],
        ["bar", "beverage"],
        "bar_signal_rule",
        context,
      ),
    );
  }

  if (hasAvSignal(record)) {
    const avItems = record.equipment
      .filter((item) =>
        /\bmic\b|\bmicrophone\b|\bprojector\b|\bscreen\b|\bpodium\b|\bav\b|\bspeaker\b/i.test(item.name),
      )
      .map((item) => (item.quantity !== null ? `${item.quantity}x ${item.name}` : item.name));

    tasks.push(
      createTask(
        "av",
        "Verify AV setup",
        "Confirm audio/visual equipment placement and functionality before event start.",
        record.setupStart ?? record.guestArrivalTime ?? null,
        "high",
        [
          ...avItems,
          "Test all AV equipment before guest arrival",
          "Coordinate podium and microphone placement with room layout",
        ],
        ["av", "equipment"],
        "av_signal_rule",
        context,
      ),
    );
  }

  if (record.equipment.length > 0) {
    tasks.push(
      createTask(
        "setup",
        "Stage requested equipment",
        "Place and verify non-AV equipment requested for the event.",
        record.setupStart ?? null,
        "medium",
        record.equipment.map((item) => (item.quantity !== null ? `${item.quantity}x ${item.name}` : item.name)),
        ["equipment", "setup"],
        "equipment_general_rule",
        context,
      ),
    );
  }

  if (record.billingNotes.finalGuaranteeDue) {
    tasks.push(
      createTask(
        "management",
        "Confirm final guarantee deadline",
        "Verify that the final guarantee has been received or follow up before deadline.",
        record.billingNotes.finalGuaranteeDue,
        "medium",
        [`Final guarantee due: ${record.billingNotes.finalGuaranteeDue}`],
        ["billing", "guarantee"],
        "final_guarantee_due_rule",
        context,
      ),
    );
  }

  return dedupeTasks(tasks);
}
