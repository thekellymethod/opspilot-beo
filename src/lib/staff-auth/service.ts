import { STAFF_SESSION_MAX_AGE_SECONDS } from "./constants";
import {
  buildStaffSessionFromToken,
  createEventSession,
  findEmployeeByCode,
  findEventByCode,
} from "./repository";
import type { StaffSession } from "./types";

export type CodeLoginInput = {
  employeeCode: string;
  eventCode: string;
  deviceLabel?: string | null;
};

export type CodeLoginResult =
  | {
      ok: true;
      sessionToken: string;
      staffSession: StaffSession;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

function canEmployeeAccessEvent(params: {
  employeePropertyId: string;
  eventPropertyId: string;
  eventStatus: string;
}): boolean {
  const sameProperty = params.employeePropertyId === params.eventPropertyId;
  const allowedStatuses = new Set(["active", "upcoming"]);
  return sameProperty && allowedStatuses.has(params.eventStatus);
}

export async function loginWithCodes(
  input: CodeLoginInput,
): Promise<CodeLoginResult> {
  const employeeCode = normalizeCode(input.employeeCode);
  const eventCode = normalizeCode(input.eventCode);

  if (!employeeCode || !eventCode) {
    return {
      ok: false,
      status: 400,
      error: "Employee code and event code are required.",
    };
  }

  const employee = await findEmployeeByCode(employeeCode);
  if (!employee || !employee.active) {
    return {
      ok: false,
      status: 401,
      error: "Invalid employee code.",
    };
  }

  const event = await findEventByCode(eventCode);
  if (!event) {
    return {
      ok: false,
      status: 401,
      error: "Invalid event code.",
    };
  }

  if (
    !canEmployeeAccessEvent({
      employeePropertyId: employee.propertyId,
      eventPropertyId: event.propertyId,
      eventStatus: event.status,
    })
  ) {
    return {
      ok: false,
      status: 403,
      error: "Employee and event are not authorized together.",
    };
  }

  const expiresAt = new Date(
    Date.now() + STAFF_SESSION_MAX_AGE_SECONDS * 1000,
  ).toISOString();

  const session = await createEventSession({
    employeeId: employee.id,
    eventId: event.id,
    deviceLabel: input.deviceLabel ?? null,
    expiresAt,
  });

  const staffSession = await buildStaffSessionFromToken(session.sessionToken);
  if (!staffSession) {
    return {
      ok: false,
      status: 500,
      error: "Unable to create session.",
    };
  }

  return {
    ok: true,
    sessionToken: session.sessionToken,
    staffSession,
  };
}
