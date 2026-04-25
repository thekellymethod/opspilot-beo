-- Post-approval orchestration: archive flags, persisted briefings, activity log.

alter table event_tasks
  add column if not exists archived boolean not null default false;

create index if not exists idx_event_tasks_event_active
  on event_tasks (event_id)
  where coalesce(archived, false) = false;

create table if not exists event_briefings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  version_id uuid not null references event_versions(id) on delete cascade,
  briefing_management jsonb not null,
  department_summaries jsonb not null default '{}'::jsonb,
  operational_changes jsonb not null default '[]'::jsonb,
  validation jsonb null,
  promoted_by text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_event_briefings_event_created
  on event_briefings (event_id, created_at desc);

create table if not exists event_activity (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  actor_label text null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_event_activity_event_created
  on event_activity (event_id, created_at desc);
