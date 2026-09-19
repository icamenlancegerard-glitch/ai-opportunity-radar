# MVP 3.0 — Authenticated Per-User Alert Subscriptions

MVP 3.0 turns Alert Preferences from a browser-local display filter into authenticated, user-owned subscription state.

## Boundary

Bearer token → existing HTTPS identity provider /me → authenticated subject → alert subscription store → user-matched alerts

The API never trusts a client-supplied owner id. The authenticated identity subject is the ownership key.

## API

- GET /api/alert-subscriptions
- POST /api/alert-subscriptions
- PATCH /api/alert-subscriptions?id=<subscriptionId>
- DELETE /api/alert-subscriptions?id=<subscriptionId>
- GET /api/user-alerts

A subscription contains:

- stable id
- name
- enabled flag
- alert categories
- optional monitored source IDs
- created/updated timestamps

Up to 10 subscriptions are supported per authenticated user.

## Provider boundary

The existing Supabase REST client is reused for durable persistence when RADAR_SUPABASE_URL and RADAR_SUPABASE_SERVICE_ROLE_KEY are configured.

Run supabase/mvp-3-0.sql after the MVP 2.8 migration to create radar_alert_subscriptions.

An optional HTTPS JSON subscription provider is also supported through RADAR_ALERT_SUBSCRIPTION_STORE_URL and RADAR_ALERT_SUBSCRIPTION_STORE_TOKEN.

Without a configured provider, the subscription store is explicitly memory-only and durable:false.

## Alert semantics

Recorded evidence and global change-alert generation are unchanged.

/api/user-alerts applies the authenticated user's active subscription rules after reading the deterministic monitored-source alerts.

Known event codes are filtered by category: source health, availability, Philippines eligibility, and compensation.

Unknown future event codes remain eligible rather than being silently discarded.

## Browser behavior

The UI now has an authenticated Alert Subscriptions panel.

The identity provider bearer token is kept only in sessionStorage for the current browser session. It is not written to localStorage, and the UI does not collect passwords.

When an authenticated session has no subscriptions, the UI creates one default subscription using the current alert-category selection.

The authenticated Alert Center reads /api/user-alerts. Without an authenticated session, the existing public Alert Center and browser-local preference fallback remain available.

## Verification boundary

Passing contract tests proves code behavior for the tested boundary. It does not prove that a real Supabase account, identity provider session, Resend delivery path, or production deployment has been exercised.

Production durability remains UNKNOWN until the configured provider is actually exercised.