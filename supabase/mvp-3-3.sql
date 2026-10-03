-- AI Opportunity Radar MVP 3.3
-- Database boundary hardening for the existing server-side persistence model.
-- The Radar adapter uses service-role credentials server-side; these tables remain
-- private to that boundary and are not intended for direct anon/authenticated access.
--
-- Security hardening:
-- 1) Pin function search_path to an empty path to remove mutable search_path risk.
-- 2) Remove direct table privileges from anon/authenticated roles.
-- 3) Remove public RPC execution and grant execution explicitly to service_role.
--
-- Run after supabase/mvp-3-2.sql.

alter function public.radar_claim_alert_event(text, timestamptz, timestamptz)
  set search_path = '';

alter function public.radar_mark_alert_delivered(text, timestamptz)
  set search_path = '';

alter function public.radar_mark_alert_failed(text, text, timestamptz, integer)
  set search_path = '';

alter function public.radar_claim_monitor_schedule(text, timestamptz, timestamptz)
  set search_path = '';

alter function public.radar_mark_monitor_schedule_complete(text, timestamptz, timestamptz, timestamptz)
  set search_path = '';

alter function public.radar_release_monitor_schedule(text, timestamptz)
  set search_path = '';

revoke all on table public.radar_history from anon, authenticated;
revoke all on table public.radar_alert_events from anon, authenticated;
revoke all on table public.radar_alert_subscriptions from anon, authenticated;
revoke all on table public.radar_monitor_schedules from anon, authenticated;

revoke all on function public.radar_claim_alert_event(text, timestamptz, timestamptz)
  from public, anon, authenticated;
revoke all on function public.radar_mark_alert_delivered(text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.radar_mark_alert_failed(text, text, timestamptz, integer)
  from public, anon, authenticated;

revoke all on function public.radar_claim_monitor_schedule(text, timestamptz, timestamptz)
  from public, anon, authenticated;
revoke all on function public.radar_mark_monitor_schedule_complete(text, timestamptz, timestamptz, timestamptz)
  from public, anon, authenticated;
revoke all on function public.radar_release_monitor_schedule(text, timestamptz)
  from public, anon, authenticated;

grant execute on function public.radar_claim_alert_event(text, timestamptz, timestamptz)
  to service_role;
grant execute on function public.radar_mark_alert_delivered(text, timestamptz)
  to service_role;
grant execute on function public.radar_mark_alert_failed(text, text, timestamptz, integer)
  to service_role;

grant execute on function public.radar_claim_monitor_schedule(text, timestamptz, timestamptz)
  to service_role;
grant execute on function public.radar_mark_monitor_schedule_complete(text, timestamptz, timestamptz, timestamptz)
  to service_role;
grant execute on function public.radar_release_monitor_schedule(text, timestamptz)
  to service_role;
