import { randomUUID } from "crypto";
import type {
  EmployeeRecord,
  EventRecord,
  EventSessionRecord,
  StaffSession,
} from "./types";

type CreateEventSessionInput = {
  employeeId: string;
  eventId: string;
  deviceLabel?: string | null;
  expiresAt: string;
};

const mockEmployees: EmployeeRecord[] = [
  {
    id: "emp_001",
    propertyId: "prop_001",
    employeeCode: "K4821",
    firstName: "John",
    lastName: "Davis",
    department: "kitchen",
    role: "line_cook",
    active: true,
  },
  {
    id: "emp_002",
    propertyId: "prop_001",
    employeeCode: "B2044",
    firstName: "Maria",
    lastName: "Lopez",
    department: "banquets",
    role: "captain",
    active: true,
  },
];

const mockEvents: EventRecord[] = [
  {
    id: "evt_001",
    propertyId: "prop_001",
    eventCode: "WED512",
    eventName: "Wilson Wedding Reception",
    eventDate: "2026-05-12",
    status: "active",
  },
  {
    id: "evt_002",
    propertyId: "prop_001",
    eventCode: "CORP620",
    eventName: "ABC Pharma Dinner",
    eventDate: "2026-06-20",
    status: "upcoming",
  },
];

const mockSessions = new Map<string, EventSessionRecord>();

export async function findEmployeeByCode(
  employeeCode: string,
): Promise<EmployeeRecord | null> {
  const normalized = employeeCode.trim().toUpperCase();
  return (
    mockEmployees.find((employee) => employee.employeeCode === normalized) ??
    null
  );
}

export async function findEventByCode(
  eventCode: string,
): Promise<EventRecord | null> {
  const normalized = eventCode.trim().toUpperCase();
  return mockEvents.find((event) => event.eventCode === normalized) ?? null;
}

export async function createEventSession(
  input: CreateEventSessionInput,
): Promise<EventSessionRecord> {
  const session: EventSessionRecord = {
    id: randomUUID(),
    employeeId: input.employeeId,
    eventId: input.eventId,
    sessionToken: randomUUID(),
    deviceLabel: input.deviceLabel ?? null,
    active: true,
    checkedInAt: new Date().toISOString(),
    checkedOutAt: null,
    expiresAt: input.expiresAt,
  };

  mockSessions.set(session.sessionToken, session);
  return session;
}

export async function findEventSessionByToken(
  sessionToken: string,
): Promise<EventSessionRecord | null> {
  const session = mockSessions.get(sessionToken);
  if (!session) return null;
  return session;
}

export async function deactivateEventSession(
  sessionToken: string,
): Promise<void> {
  const session = mockSessions.get(sessionToken);
  if (!session) return;

  mockSessions.set(sessionToken, {
    ...session,
    active: false,
    checkedOutAt: new Date().toISOString(),
  });
}

export async function buildStaffSessionFromToken(
  sessionToken: string,
): Promise<StaffSession | null> {
  const session = await findEventSessionByToken(sessionToken);
  if (!session || !session.active) return null;

  const now = Date.now();
  const expiry = new Date(session.expiresAt).getTime();
  if (Number.isNaN(expiry) || expiry <= now) {
    return null;
  }

  const employee = mockEmployees.find((item) => item.id === session.employeeId);
  const event = mockEvents.find((item) => item.id === session.eventId);

  if (!employee || !event || !employee.active) return null;

  return {
    sessionId: session.id,
    employee: {
      id: employee.id,
      name: `${employee.firstName} ${employee.lastName}`,
      department: employee.department,
      role: employee.role,
    },
    event: {
      id: event.id,
      name: event.eventName,
      code: event.eventCode,
      date: event.eventDate,
      status: event.status,
    },
    expiresAt: session.expiresAt,
  };
}
