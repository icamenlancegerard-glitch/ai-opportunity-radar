# AI Opportunity Radar

**MVP 2.4 — evidence-first opportunity monitoring**

AI Opportunity Radar is a lightweight web prototype for finding AI-related work opportunities while keeping uncertainty visible.

## Current MVP
- Search by title, company, skill, or location
- Filter by opportunity type and work mode
- Browser-saved searches
- Deterministic change-alert events
- Evidence-status badges
- Freshness status based on recorded `lastChecked`
- Direct source links
- Shared, allowlisted server-side source policy
- Canonical recheck pipeline: source policy → bounded content → availability evidence → PH eligibility evidence → compensation evidence → snapshot → history → change detection → opportunity status → change alerts
- Mobile-friendly UI
- Explicit separation between source evidence, freshness, reachability, availability evidence, PH eligibility evidence, compensation evidence, and final claims

## MVP 2.0 — change alerts
A recheck can emit deterministic event labels when meaningful recorded evidence changes:
- source down / recovered
- availability opens, closes, or becomes conflicting
- Philippines eligibility appears, is excluded, or becomes conflicting
- compensation evidence appears, disappears, or changes

Alert events are summaries only. The API does not send email, push, SMS, or other external notifications.

## Saved searches
Saved searches use a validated schema and persist in browser `localStorage` for this MVP. The contract caps saved searches at 10 and supports query, type, work mode, and location filters.

Server-side saved-search persistence is deferred until a real user identity/storage provider exists.

## Durable history
The history store supports an HTTPS persistence-provider boundary through `HISTORY_STORE_URL`. Without a valid provider, runtime remains `memory-only` and `durable:false`.

## Evidence boundary
PH eligibility is evidence only when explicit applicant/location language supports it. Generic mentions of the Philippines do not establish eligibility.

Compensation is evidence only when bounded source text contains explicit currency + amount/range + payment unit. Vague salary language remains `NOT_VERIFIED`.

HTTP reachability, availability evidence, eligibility evidence, compensation evidence, and final hiring truth remain separate.

## Freshness rule
- **Fresh:** 0–1 days since last check
- **Aging:** 2–3 days
- **Stale:** 4+ days
- **Unknown:** missing or invalid check date

Freshness is a prioritization signal, not a truth claim.

## Next build
1. Connect a real durable history provider for production monitoring
2. External alert delivery
3. Server-side saved searches with user identity
4. URL canonicalization beyond fragment normalization and deduplication
5. Optional paid tier

## Separation
This project is separate from AI HITS and does not modify the AI HITS repositories.


## MVP 2.2 — alert center + server sync

The browser UI now:
- generates a per-browser owner identifier for saved-search sync
- loads saved searches from the server API and keeps a local fallback
- saves new searches to the server API when available
- exposes a read-only Alert Center for the currently monitored sources

The Alert Center reads deterministic recorded change events. It does not send email, push, SMS, or other external notifications.

Server-side saved-search storage remains honest:
- without `RADAR_SAVED_SEARCH_STORE_URL`, storage is memory-only and `durable:false`
- the browser owner ID is not authentication
- production identity/authentication is still a separate step

## Verification boundary

A green code/test result does not prove production durability or deployment availability. Those remain `not verified` until the configured provider and deployment can be exercised successfully.


## MVP 2.3 — identity + alert delivery boundaries

MVP 2.3 removes client-supplied owner IDs from the authenticated saved-search path. The server now resolves the owner subject through an HTTPS identity provider:

- `RADAR_IDENTITY_PROVIDER_URL` — HTTPS identity provider exposing `GET /me`
- request authentication uses an HTTP Bearer token
- provider response must include a validated `subject`
- missing identity provider configuration is reported instead of silently falling back to an owner ID

Session introspection is available at `/api/session`. It verifies an existing identity; it does not create an identity or provide a login UI.

### Alert outbox

Deterministic change alerts now have an optional outbox boundary:

- `RADAR_ALERT_OUTBOX_URL`
- `RADAR_ALERT_OUTBOX_TOKEN`
- provider contract: `POST /events`, `GET /events`, `POST /events/{eventKey}/delivered`

The outbox deduplicates events by `code + url + checkedAt`.

### External delivery

Notification delivery has a separate HTTPS provider boundary:

- `RADAR_ALERT_DELIVERY_URL`
- `RADAR_ALERT_DELIVERY_TOKEN`
- provider contract: `POST /deliver`

No email, push, SMS, or other external delivery is claimed unless that provider is actually configured and exercised.

### Current verification boundary

The repository can test all three provider boundaries with mocked HTTPS calls, but provider configuration is still a deployment concern. Without configured providers, runtime status remains explicit about `not_verified` / `not-configured` states.


## MVP 2.4 — scheduled monitoring

The Radar now has a protected scheduled monitor at `/api/monitor`.

Vercel Cron is configured for:
- path: `/api/monitor`
- schedule: `0 2 * * *`

The endpoint requires `Authorization: Bearer <CRON_SECRET>`. It rechecks the canonical monitored sources through the existing evidence pipeline, records history, derives deterministic change alerts, and queues those alerts in the configured outbox.

The monitor does not automatically claim external notification delivery. With no durable history/outbox provider, the scheduled process remains explicitly non-durable across serverless invocations.

### MVP 2.4 verification boundary

- Cron handler authentication: tested
- Monitoring loop behavior: tested with deterministic mocks
- Existing Radar regression suites: retained
- Real cron execution in production: not verified while Vercel deployment is blocked by the current build-rate limit
- Durable history/outbox: not verified until providers are actually configured
- External alert delivery: not verified until delivery provider is actually configured and exercised

## Next build

1. Real authenticated identity provider integration
2. Real durable database/history + outbox provider
3. Production email/push delivery
4. URL canonicalization and monitored-source lifecycle management
5. User-configurable schedules
