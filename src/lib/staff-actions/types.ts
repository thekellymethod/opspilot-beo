export type StaffTaskStatus =
  | "pending"
  | "acknowledged"
  | "completed"
  | "failed";

export type StaffTaskRecord = {
  id: string;
  eventId: string;
  department: string;
  title: string;
  description: string;
  status: StaffTaskStatus;
  assignedToEmployeeId: string | null;
  completedAt: string | null;
  completedByEmployeeId: string | null;
};

export type ShiftEventType = "checkin" | "checkout";

export type ShiftEventRecord = {
  id: string;
  eventId: string;
  employeeId: string;
  eventType: ShiftEventType;
  createdAt: string;
  note: string | null;
};

export type BriefingAcknowledgmentInput = {
  eventId: string;
  department: string;
  employeeId: string;
  acknowledgedBy: string;
};

export type CompleteTaskInput = {
  taskId: string;
  employeeId: string;
};

export type ShiftEventInput = {
  eventId: string;
  employeeId: string;
  eventType: ShiftEventType;
  note?: string | null;
};
