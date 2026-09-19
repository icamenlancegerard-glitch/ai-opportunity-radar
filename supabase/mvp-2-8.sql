-- AI Opportunity Radar MVP 2.8
-- Supabase/Postgres schema for durable history + alert outbox.
-- Keep these tables private: RLS is enabled with no public policies.
-- The service-role key is used only by the server-side Radar adapter.

create table if not exists public.radar_history (
  id bigint generated always as identity primary key,
  source_url text not null,
  checked_at timestamptz not null,
  record jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists radar_history_source_checked_idx
  on public.radar_history (source_url, checked_at desc);

alter table public.radar_history enable row level security;

create table if not exists public.radar_alert_events (
  event_key text primary key,
  code text not null,
  severity text not null,
  title text not null,
  url text not null,
  checked_at timestamptz not null,
  source_url text,
  status text not null check (status in ('queued','delivering','retry','delivered','failed')),
  attempts integer not null default 0 check (attempts >= 0),
  created_at timestamptz not null default now(),
  next_attempt_at timestamptz,
  lease_until timestamptz,
  last_error text,
  delivered_at timestamptz,
  payload jsonb not null
);

create index if not exists radar_alert_events_due_idx
  on public.radar_alert_events (status, next_attempt_at, lease_until, created_at);

alter table public.radar_alert_events enable row level security;

create or replace function public.radar_claim_alert_event(
  p_event_key text,
  p_lease_until timestamptz,
  p_now timestamptz
)
returns setof public.radar_alert_events
language sql
as $$
  update public.radar_alert_events
  set
    status = 'delivering',
    attempts = attempts + 1,
    lease_until = p_lease_until,
    next_attempt_at = null,
    last_error = null
  where event_key = p_event_key
    and (
      status = 'queued'
      or (status = 'retry' and (next_attempt_at is null or next_attempt_at <= p_now))
      or (status = 'delivering' and (lease_until is null or lease_until <= p_now))
    )
  returning *;
$$;

create or replace function public.radar_mark_alert_delivered(
  p_event_key text,
  p_now timestamptz
)
returns setof public.radar_alert_events
language sql
as $$
  update public.radar_alert_events
  set
    status = 'delivered',
    delivered_at = p_now,
    lease_until = null,
    next_attempt_at = null,
    last_error = null
  where event_key = p_event_key
  returning *;
$$;

create or replace function public.radar_mark_alert_failed(
  p_event_key text,
  p_error text,
  p_next_attempt_at timestamptz,
  p_max_attempts integer
)
returns setof public.radar_alert_events
language sql
as $$
  update public.radar_alert_events
  set
    status = case when attempts >= p_max_attempts then 'failed' else 'retry' end,
    lease_until = null,
    next_attempt_at = case when attempts >= p_max_attempts then null else p_next_attempt_at end,
    last_error = left(coalesce(p_error, 'delivery failed'), 2000)
  where event_key = p_event_key
  returning *;
$$;
