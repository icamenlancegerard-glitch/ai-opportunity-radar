-- AI Opportunity Radar MVP 3.1
-- Durable authenticated per-user monitoring schedules.
-- Run after supabase/mvp-3-0.sql.

create table if not exists public.radar_monitor_schedules (
  id text primary key,
  owner_id text not null,
  name text not null,
  enabled boolean not null default true,
  cadence_days integer not null check (cadence_days in (1,3,7,14,30)),
  source_ids jsonb not null default '[]'::jsonb,
  next_run_at timestamptz not null,
  last_run_at timestamptz,
  lease_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists radar_monitor_schedules_due_idx
  on public.radar_monitor_schedules (enabled, next_run_at, lease_until);

create index if not exists radar_monitor_schedules_owner_idx
  on public.radar_monitor_schedules (owner_id, updated_at desc);

alter table public.radar_monitor_schedules enable row level security;

create or replace function public.radar_claim_monitor_schedule(
  p_schedule_id text,
  p_lease_until timestamptz,
  p_now timestamptz
)
returns setof public.radar_monitor_schedules
language sql
as $$
  update public.radar_monitor_schedules
  set
    lease_until = p_lease_until,
    updated_at = p_now
  where id = p_schedule_id
    and enabled = true
    and next_run_at <= p_now
    and (lease_until is null or lease_until <= p_now)
  returning *;
$$;

create or replace function public.radar_mark_monitor_schedule_complete(
  p_schedule_id text,
  p_next_run_at timestamptz,
  p_last_run_at timestamptz,
  p_now timestamptz
)
returns setof public.radar_monitor_schedules
language sql
as $$
  update public.radar_monitor_schedules
  set
    next_run_at = p_next_run_at,
    last_run_at = p_last_run_at,
    lease_until = null,
    updated_at = p_now
  where id = p_schedule_id
  returning *;
$$;

create or replace function public.radar_release_monitor_schedule(
  p_schedule_id text,
  p_now timestamptz
)
returns setof public.radar_monitor_schedules
language sql
as $$
  update public.radar_monitor_schedules
  set
    lease_until = null,
    updated_at = p_now
  where id = p_schedule_id
  returning *;
$$;
