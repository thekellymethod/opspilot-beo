-- Staff code login (employee + event + session). Aligns with existing `events` table.

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null,
  employee_code text not null unique,
  first_name text not null,
  last_name text not null,
  department text not null,
  role text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists employees_property_id_idx
  on employees (property_id);

create index if not exists employees_employee_code_idx
  on employees (employee_code);

alter table events add column if not exists event_code text;

create unique index if not exists events_event_code_unique
  on events (event_code)
  where event_code is not null;

create index if not exists events_event_code_lookup_idx
  on events (event_code);

create table if not exists event_sessions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  session_token text not null unique,
  device_label text,
  active boolean not null default true,
  checked_in_at timestamptz not null default now(),
  checked_out_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists event_sessions_employee_id_idx
  on event_sessions (employee_id);

create index if not exists event_sessions_event_id_idx
  on event_sessions (event_id);

create index if not exists event_sessions_session_token_idx
  on event_sessions (session_token);

create index if not exists event_sessions_active_idx
  on event_sessions (active);

create table if not exists event_acknowledgments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  employee_id uuid references employees(id) on delete set null,
  department text not null,
  acknowledged boolean not null default false,
  acknowledged_at timestamptz,
  acknowledged_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, department)
);

create index if not exists event_acknowledgments_event_id_idx
  on event_acknowledgments (event_id);
