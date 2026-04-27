create extension if not exists "pgcrypto";

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  property_id uuid null,
  event_name text not null,
  client_name text not null,
  event_date date not null,
  room_name text not null,
  event_type text not null,
  status text not null default 'active',
  current_version_id uuid null,
  created_at timestamptz not null default now()
);

create table if not exists event_versions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  version_number int not null,
  raw_text text not null,
  parsed_json jsonb not null,
  normalized_json jsonb null,
  source_file_url text null,
  created_at timestamptz not null default now()
);

create table if not exists event_tasks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  department text not null check (department in ('kitchen', 'banquets', 'bar')),
  title text not null,
  due_at timestamptz null,
  checklist jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'complete'))
);

alter table event_tasks alter column department drop not null;
alter table event_tasks
  add constraint if not exists event_tasks_department_check
  check (department in ('kitchen','banquets','bar','management','setup','av','engineering','housekeeping','security','front_office'));
alter table event_tasks add column if not exists owner_employee_id uuid null;
alter table event_tasks add column if not exists owner_department text null;
alter table event_tasks add column if not exists assigned_at timestamptz null;
alter table event_tasks add column if not exists assigned_by text null;
alter table event_tasks add column if not exists acknowledged_at timestamptz null;
alter table event_tasks add column if not exists acknowledged_by text null;
alter table event_tasks add column if not exists completed_at timestamptz null;
alter table event_tasks add column if not exists completed_by_employee_id uuid null;
alter table event_tasks add column if not exists completion_note text null;
alter table event_tasks add column if not exists priority text null;
alter table event_tasks drop constraint if exists event_tasks_status_check;
alter table event_tasks add constraint event_tasks_status_check check (status in ('pending','acknowledged','blocked','complete'));

create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  message text not null,
  affected_departments jsonb not null default '[]'::jsonb,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

alter table alerts add column if not exists state text not null default 'new';
alter table alerts add column if not exists owner_employee_id uuid null;
alter table alerts add column if not exists owner_department text null;
alter table alerts add column if not exists acknowledged_at timestamptz null;
alter table alerts add column if not exists acknowledged_by text null;
alter table alerts add column if not exists resolved_at timestamptz null;
alter table alerts add column if not exists resolved_by text null;
alter table alerts add column if not exists escalation_level int not null default 0;
alter table alerts add column if not exists due_at timestamptz null;
alter table alerts add column if not exists source_version_id uuid null;

create table if not exists staff_roster (
  id uuid primary key default gen_random_uuid(),
  property_id uuid null,
  staff_name text not null,
  department text not null check (department in ('kitchen', 'banquets', 'bar')),
  role text null,
  shift_date date not null,
  available boolean not null default true,
  created_at timestamptz not null default now()
);
alter table staff_roster drop constraint if exists staff_roster_department_check;
alter table staff_roster
  add constraint staff_roster_department_check
  check (department in ('kitchen','banquets','bar','management','setup','av','engineering','housekeeping','security','front_office'));

create table if not exists event_staff_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  staff_roster_id uuid not null references staff_roster(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  unique (event_id, staff_roster_id)
);

create table if not exists event_change_views (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  title text not null,
  summary text not null,
  created_at timestamptz not null default now()
);

create table if not exists event_confirmations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  version_id uuid null references event_versions(id) on delete set null,
  department text not null,
  scope text not null default 'ops_plan',
  required boolean not null default true,
  acknowledged boolean not null default false,
  acknowledged_at timestamptz null,
  acknowledged_by text null,
  note text null,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_event_confirmations_unique
  on event_confirmations(event_id, version_id, department, scope);

create index if not exists idx_events_event_date on events(event_date);
create index if not exists idx_event_versions_event_id on event_versions(event_id, version_number desc);
create index if not exists idx_event_tasks_event_id on event_tasks(event_id);
create index if not exists idx_alerts_event_id on alerts(event_id, created_at desc);
create index if not exists idx_staff_roster_shift_date on staff_roster(shift_date, department);
create index if not exists idx_event_staff_assignments_event on event_staff_assignments(event_id, assigned_at desc);
create index if not exists idx_event_change_views_event on event_change_views(event_id, created_at desc);

-- Immutable BEO intake + pipeline snapshots (traceability; do not parse directly without promotion when review is required)
create table if not exists beo_sources (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('pdf', 'email_text')),
  filename text null,
  property_id uuid null,
  uploaded_by text null,
  uploaded_at timestamptz not null default now(),
  sender text null,
  linked_event_id uuid null references events(id) on delete set null,
  revision_sequence int null,
  raw_text text not null default '',
  cleaned_text text null,
  raw_text_status text not null default 'pending' check (raw_text_status in ('pending', 'complete', 'failed')),
  parse_status text not null default 'pending' check (parse_status in ('pending', 'extracting', 'complete', 'failed', 'review_required', 'approved')),
  storage_url text null,
  prompt_version text null,
  latest_ai_extraction jsonb null,
  latest_normalized jsonb null,
  latest_validation jsonb null,
  requires_human_review boolean not null default false
);

create index if not exists idx_beo_sources_property on beo_sources(property_id, uploaded_at desc);
create index if not exists idx_beo_sources_linked_event on beo_sources(linked_event_id);

-- Supervised corrections after human review (training data)
create table if not exists beo_review_corrections (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references beo_sources(id) on delete cascade,
  field_key text not null,
  action text not null check (action in ('accept', 'edit', 'unknown')),
  previous_value jsonb null,
  corrected_value jsonb null,
  created_at timestamptz not null default now(),
  corrected_by text null
);

create index if not exists idx_beo_review_corrections_source on beo_review_corrections(source_id, created_at desc);

-- If `event_versions` already existed without normalized_json:
alter table event_versions add column if not exists normalized_json jsonb;

-- If `event_tasks` already existed before archival support:
alter table event_tasks add column if not exists archived boolean not null default false;

-- Per checklist line completion (parallel array to `checklist` JSON strings)
alter table event_tasks add column if not exists checklist_done jsonb null;
