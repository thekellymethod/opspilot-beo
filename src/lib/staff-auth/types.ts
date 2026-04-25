export type StaffDepartment =
  | "management"
  | "kitchen"
  | "banquets"
  | "bar"
  | "setup"
  | "av"
  | string;

export type EmployeeRecord = {
  id: string;
  propertyId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  department: StaffDepartment;
  role: string;
  active: boolean;
};

export type EventRecord = {
  id: string;
  propertyId: string;
  eventCode: string;
  eventName: string;
  eventDate: string;
  status: string;
};

export type EventSessionRecord = {
  id: string;
  employeeId: string;
  eventId: string;
  sessionToken: string;
  deviceLabel: string | null;
  active: boolean;
  checkedInAt: string;
  checkedOutAt: string | null;
  expiresAt: string;
};

export type StaffSession = {
  sessionId: string;
  employee: {
    id: string;
    name: string;
    department: string;
    role: string;
  };
  event: {
    id: string;
    name: string;
    code: string;
    date: string;
    status: string;
  };
  expiresAt: string;
};
