-- AI Opportunity Radar MVP 3.2
-- User-scoped alert routing metadata is stored inside radar_alert_events.payload.
-- No new delivery table is required for this boundary.
-- Run after supabase/mvp-3-1.sql.

create index if not exists radar_alert_events_owner_idx
  on public.radar_alert_events ((payload->>'ownerId'), created_at desc);
