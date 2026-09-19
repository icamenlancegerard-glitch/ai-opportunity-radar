-- AI Opportunity Radar MVP 3.0
-- Durable authenticated per-user alert subscriptions.
-- RLS is enabled with no public policies; the server uses the existing
-- Supabase service-role persistence boundary.
--
-- Run after supabase/mvp-2-8.sql.

create table if not exists public.radar_alert_subscriptions (
  id text primary key,
  owner_id text not null,
  name text not null,
  enabled boolean not null default true,
  categories jsonb not null,
  source_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists radar_alert_subscriptions_owner_updated_idx
  on public.radar_alert_subscriptions (owner_id, updated_at desc);

alter table public.radar_alert_subscriptions enable row level security;

create index if not exists radar_alert_subscriptions_owner_id_idx
  on public.radar_alert_subscriptions (owner_id);
