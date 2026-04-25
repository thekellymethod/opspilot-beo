import type { NormalizedBeoRecord, Severity } from "@/lib/beo/types";

export type ChangeImpactDepartment =
  | "management"
  | "kitchen"
  | "banquets"
  | "bar"
  | "setup"
  | "av";

export type OperationalChange = {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  severity: Severity;
  title: string;
  message: string;
  affectedDepartments: ChangeImpactDepartment[];
  recommendedActions: string[];
};

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function pushChange(changes: OperationalChange[], change: OperationalChange): void {
  changes.push(change);
}

function diffArrayStrings(oldArr: string[], newArr: string[]) {
  const oldSet = new Set(oldArr.map((v) => v.toLowerCase()));
  const newSet = new Set(newArr.map((v) => v.toLowerCase()));

  const added = newArr.filter((v) => !oldSet.has(v.toLowerCase()));
  const removed = oldArr.filter((v) => !newSet.has(v.toLowerCase()));

  return { added, removed };
}

function areEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function hasBarSignal(record: NormalizedBeoRecord): boolean {
  const blob = [...record.specialRequests, ...record.staffingNotes, ...record.equipment.map((e) => e.name)]
    .join(" ")
    .toLowerCase();

  return /\bbar\b|\bbartender\b|\bcocktail\b|\bbeer\b|\bwine\b|\bliquor\b/.test(blob);
}

export function detectOperationalChanges(previous: NormalizedBeoRecord, current: NormalizedBeoRecord): OperationalChange[] {
  const changes: OperationalChange[] = [];

  if (previous.eventDate !== current.eventDate) {
    pushChange(changes, {
      field: "eventDate",
      oldValue: previous.eventDate,
      newValue: current.eventDate,
      severity: "high",
      title: "Event date changed",
      message: `Event date changed from ${stringifyValue(previous.eventDate)} to ${stringifyValue(current.eventDate)}.`,
      affectedDepartments: ["management", "kitchen", "banquets", "bar", "setup", "av"],
      recommendedActions: [
        "Reconfirm all staffing assignments",
        "Reconfirm production schedule",
        "Reconfirm setup timing and room availability",
      ],
    });
  }

  if (previous.roomName !== current.roomName) {
    pushChange(changes, {
      field: "roomName",
      oldValue: previous.roomName,
      newValue: current.roomName,
      severity: "high",
      title: "Room assignment changed",
      message: `Room changed from ${stringifyValue(previous.roomName)} to ${stringifyValue(current.roomName)}.`,
      affectedDepartments: ["management", "banquets", "setup", "av"],
      recommendedActions: [
        "Reconfirm room setup plan",
        "Reconfirm equipment placement",
        "Notify service and setup teams",
      ],
    });
  }

  if (previous.roomSetupStyle !== current.roomSetupStyle) {
    pushChange(changes, {
      field: "roomSetupStyle",
      oldValue: previous.roomSetupStyle,
      newValue: current.roomSetupStyle,
      severity: "high",
      title: "Room setup style changed",
      message: `Room setup changed from ${previous.roomSetupStyle} to ${current.roomSetupStyle}.`,
      affectedDepartments: ["management", "banquets", "setup", "av"],
      recommendedActions: [
        "Reconfigure room layout",
        "Review table and chair requirements",
        "Reconfirm podium and AV placement if needed",
      ],
    });
  }

  if (previous.serviceStyle !== current.serviceStyle) {
    pushChange(changes, {
      field: "serviceStyle",
      oldValue: previous.serviceStyle,
      newValue: current.serviceStyle,
      severity: "critical",
      title: "Service style changed",
      message: `Service style changed from ${previous.serviceStyle} to ${current.serviceStyle}.`,
      affectedDepartments: ["management", "kitchen", "banquets", "setup", "bar"],
      recommendedActions: [
        "Rebuild labor plan for new service model",
        "Reconfirm food production and service flow",
        "Review setup requirements for new service style",
      ],
    });
  }

  const previousCount = previous.guaranteedGuests ?? previous.expectedGuests;
  const currentCount = current.guaranteedGuests ?? current.expectedGuests;

  if (previousCount !== currentCount) {
    const oldValue = previousCount;
    const newValue = currentCount;
    const delta = oldValue !== null && newValue !== null ? newValue - oldValue : null;

    let severity: Severity = "high";
    if (delta !== null && Math.abs(delta) >= 25) severity = "critical";
    else if (delta !== null && Math.abs(delta) >= 10) severity = "high";
    else severity = "medium";

    pushChange(changes, {
      field: "guestCount",
      oldValue,
      newValue,
      severity,
      title: "Guest count changed",
      message:
        delta !== null
          ? `Guest count changed from ${oldValue} to ${newValue} (${delta > 0 ? "+" : ""}${delta}).`
          : `Guest count changed from ${stringifyValue(oldValue)} to ${stringifyValue(newValue)}.`,
      affectedDepartments: ["management", "kitchen", "banquets", "setup", "bar"],
      recommendedActions: [
        "Recalculate food production volume",
        "Reconfirm staffing coverage",
        "Reconfirm seating and table counts",
      ],
    });
  }

  const timeFields: Array<keyof NormalizedBeoRecord> = [
    "setupStart",
    "staffCallTime",
    "guestArrivalTime",
    "serviceStartTime",
    "serviceEndTime",
    "eventEndTime",
  ];

  for (const field of timeFields) {
    if (previous[field] !== current[field]) {
      pushChange(changes, {
        field: String(field),
        oldValue: previous[field],
        newValue: current[field],
        severity: "high",
        title: `${String(field)} changed`,
        message: `${String(field)} changed from ${stringifyValue(previous[field])} to ${stringifyValue(current[field])}.`,
        affectedDepartments: ["management", "kitchen", "banquets", "bar", "setup", "av"],
        recommendedActions: [
          "Update shift timing",
          "Update prep and setup timing",
          "Notify affected departments of revised timeline",
        ],
      });
    }
  }

  const previousDietary = previous.rawDietaryNotes;
  const currentDietary = current.rawDietaryNotes;
  if (!areEqual(previousDietary, currentDietary)) {
    const { added, removed } = diffArrayStrings(previousDietary, currentDietary);
    const critical = [...added, ...removed].some((item) => /\ballergy\b|\bnut\b|\bshellfish\b/i.test(item));

    pushChange(changes, {
      field: "rawDietaryNotes",
      oldValue: previousDietary,
      newValue: currentDietary,
      severity: critical ? "critical" : "high",
      title: "Dietary notes changed",
      message: `Dietary notes updated. Added: ${added.join("; ") || "none"}. Removed: ${removed.join("; ") || "none"}.`,
      affectedDepartments: ["management", "kitchen", "banquets"],
      recommendedActions: [
        "Review all dietary and allergy meal flags",
        "Notify kitchen and banquet lead",
        "Confirm guest meal handoff plan",
      ],
    });
  }

  const previousSpecial = previous.specialRequests;
  const currentSpecial = current.specialRequests;
  if (!areEqual(previousSpecial, currentSpecial)) {
    const { added, removed } = diffArrayStrings(previousSpecial, currentSpecial);

    pushChange(changes, {
      field: "specialRequests",
      oldValue: previousSpecial,
      newValue: currentSpecial,
      severity: "high",
      title: "Special requests changed",
      message: `Special requests updated. Added: ${added.join("; ") || "none"}. Removed: ${removed.join("; ") || "none"}.`,
      affectedDepartments: ["management", "banquets", "setup", "av"],
      recommendedActions: [
        "Review newly added requests",
        "Reassign ownership for each request",
        "Confirm completion before guest arrival",
      ],
    });
  }

  const previousEquipment = previous.equipment.map((e) => (e.quantity !== null ? `${e.quantity}x ${e.name}` : e.name));
  const currentEquipment = current.equipment.map((e) => (e.quantity !== null ? `${e.quantity}x ${e.name}` : e.name));

  if (!areEqual(previousEquipment, currentEquipment)) {
    const { added, removed } = diffArrayStrings(previousEquipment, currentEquipment);
    const avAffected = [...added, ...removed].some((item) =>
      /\bmic\b|\bmicrophone\b|\bprojector\b|\bscreen\b|\bpodium\b|\bav\b|\bspeaker\b/i.test(item),
    );

    pushChange(changes, {
      field: "equipment",
      oldValue: previousEquipment,
      newValue: currentEquipment,
      severity: avAffected ? "high" : "medium",
      title: "Equipment requirements changed",
      message: `Equipment updated. Added: ${added.join("; ") || "none"}. Removed: ${removed.join("; ") || "none"}.`,
      affectedDepartments: avAffected ? ["management", "setup", "av", "banquets"] : ["management", "setup", "banquets"],
      recommendedActions: [
        "Reconfirm equipment availability",
        "Update setup plan",
        avAffected ? "Retest AV setup requirements" : "Notify setup team",
      ],
    });
  }

  const previousMenu = previous.menu.map(
    (m) => `${m.course ?? "uncategorized"}|${m.item ?? "unknown"}|${m.count ?? "?"}`,
  );
  const currentMenu = current.menu.map((m) => `${m.course ?? "uncategorized"}|${m.item ?? "unknown"}|${m.count ?? "?"}`);

  if (!areEqual(previousMenu, currentMenu)) {
    pushChange(changes, {
      field: "menu",
      oldValue: previousMenu,
      newValue: currentMenu,
      severity: "high",
      title: "Menu changed",
      message: "Menu composition or counts changed from the prior version.",
      affectedDepartments: ["management", "kitchen", "banquets", "bar"],
      recommendedActions: [
        "Review revised menu counts and items",
        "Confirm kitchen production impact",
        "Confirm service sequencing impact",
      ],
    });
  }

  const previousBar = hasBarSignal(previous);
  const currentBar = hasBarSignal(current);
  if (previousBar !== currentBar) {
    pushChange(changes, {
      field: "barSignal",
      oldValue: previousBar,
      newValue: currentBar,
      severity: "medium",
      title: currentBar ? "Bar service appears added" : "Bar service appears removed",
      message: currentBar
        ? "Bar or beverage service indicators were added."
        : "Bar or beverage service indicators were removed.",
      affectedDepartments: ["management", "bar", "banquets"],
      recommendedActions: ["Verify bartender staffing plan", "Verify beverage inventory and setup needs"],
    });
  }

  return changes;
}
