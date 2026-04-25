import type { StaffSession } from "./types";

export type StaffAction =
  | "briefing.acknowledge"
  | "task.complete"
  | "shift.checkin"
  | "shift.checkout"
  | "department.view";

type PermissionRule = {
  action: StaffAction;
  allowedDepartments?: string[];
};

const RULES: PermissionRule[] = [
  {
    action: "briefing.acknowledge",
    allowedDepartments: [
      "management",
      "kitchen",
      "banquets",
      "bar",
      "setup",
      "av",
    ],
  },
  {
    action: "task.complete",
    allowedDepartments: [
      "management",
      "kitchen",
      "banquets",
      "bar",
      "setup",
      "av",
    ],
  },
  {
    action: "shift.checkin",
    allowedDepartments: [
      "management",
      "kitchen",
      "banquets",
      "bar",
      "setup",
      "av",
    ],
  },
  {
    action: "shift.checkout",
    allowedDepartments: [
      "management",
      "kitchen",
      "banquets",
      "bar",
      "setup",
      "av",
    ],
  },
  {
    action: "department.view",
    allowedDepartments: [
      "management",
      "kitchen",
      "banquets",
      "bar",
      "setup",
      "av",
    ],
  },
];

export function canPerformStaffAction(
  session: StaffSession,
  action: StaffAction,
  departmentOverride?: string | null,
): boolean {
  const rule = RULES.find((item) => item.action === action);
  if (!rule) return false;

  const effectiveDepartment = (
    departmentOverride ??
    session.employee.department ??
    ""
  ).toLowerCase();
  if (!rule.allowedDepartments || rule.allowedDepartments.length === 0) {
    return true;
  }

  return rule.allowedDepartments.includes(effectiveDepartment);
}

export function assertStaffActionAllowed(
  session: StaffSession,
  action: StaffAction,
  departmentOverride?: string | null,
): void {
  if (!canPerformStaffAction(session, action, departmentOverride)) {
    throw new Error(`Staff action not allowed: ${action}`);
  }
}
