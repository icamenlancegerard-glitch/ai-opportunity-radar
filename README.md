# AI Opportunity Radar

**MVP 3.2 — evidence-first opportunity monitoring**

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
- Browser-local evidence watchlist and watched-only filtering
- Recorded evidence history timeline per source

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

## Historical early roadmap
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

## Historical MVP 2.4 roadmap

1. Real authenticated identity provider integration
2. Real durable database/history + outbox provider
3. Production email/push delivery
4. URL canonicalization and monitored-source lifecycle management
5. User-configurable schedules


## MVP 2.5 — alert lifecycle

The Radar now separates **alert generation** from **alert delivery** with an explicit event lifecycle:

`queued → delivering → delivered`
`delivering → retry → delivering → ... → failed`

The outbox event remains deterministic by `code + url + checkedAt`. Delivery attempts are bounded and use a lease so an abandoned `delivering` event can be reclaimed. Retries use bounded exponential backoff. A terminal `failed` state records the last error without silently turning the event into a success.

### Alert delivery worker

A protected worker endpoint is available at `/api/alert-worker`.

It:
- requires `Authorization: Bearer <CRON_SECRET>`
- reads eligible queued/retry events from the outbox
- claims each event with a lease
- calls the configured HTTPS delivery provider at `POST /deliver`
- marks successful events `delivered`
- schedules bounded retries after delivery errors
- marks an event `failed` after the configured maximum attempts

Optional environment controls:
- `RADAR_ALERT_WORKER_MAX_EVENTS` (default 25, capped at 100)
- `RADAR_ALERT_WORKER_MAX_ATTEMPTS` (default 3, capped at 10)

The worker endpoint is implemented, but it is **not claimed as production-delivered** without a configured external delivery provider and durable outbox.

### Delivery semantics

MVP 2.5 is **at-least-once** rather than exactly-once. A delivery provider should treat `eventKey` as an idempotency/deduplication key. The system does not claim that a successful external send and a separate outbox acknowledgement are an atomic transaction.

### MVP 2.5 verification boundary

- Alert lifecycle state machine: tested with deterministic memory outbox
- Lease/reclaim behavior: implemented and covered by outbox tests
- Retry/backoff/terminal failure: tested with deterministic worker tests
- Monitor response serialization: tested; prevents the prior undefined-`results` regression
- Real durable outbox provider: not verified
- Real external notification provider: not verified
- Production worker execution: not verified while Vercel deployment remains blocked by the build-rate limit
- Production cron schedule for the delivery worker: intentionally not added until a real delivery provider exists

## Historical MVP 2.5 roadmap

1. Real durable provider implementation/exercise for history + alert outbox lifecycle
2. Authenticated identity provider exercise against a real account/session
3. Production notification provider exercise
4. Monitored-source lifecycle management and URL canonicalization
5. User-configurable schedules


## MVP 2.6 — monitored-source lifecycle

The Radar now keeps monitored sources in a stable lifecycle registry instead of treating the scheduled source list as an anonymous array.

Each source has:
- stable lowercase source ID
- human-readable name
- canonical HTTPS URL
- lifecycle state: `active`, `paused`, or `retired`

Only `active` sources are returned to the scheduled monitor. The registry validates duplicate IDs and duplicate canonical URLs before startup.

The monitored-source lifecycle registry is exposed through the runtime status surface; lifecycle mutation is intentionally configuration-backed for now, and a durable management API is not claimed.

### URL canonicalization

Source URLs now canonicalize deterministically by:
- requiring HTTPS
- blocking embedded credentials
- enforcing the existing host allowlist
- removing fragments
- normalizing hostname casing
- removing the default HTTPS port
- sorting query parameters

Tracking parameters are not silently stripped because their meaning is source-specific and removing them could change the requested resource.

### MVP 2.6 verification boundary

- Source registry validation: tested
- Active-source selection: tested
- Duplicate lifecycle identifiers/URLs: guarded
- URL canonicalization: tested
- Scheduled monitor uses active lifecycle entries: implemented
- Real runtime source management persistence: not verified
- Production deployment: remains blocked by the current Vercel build-rate limit


## MVP 3.1 — user monitoring schedules

MVP 3.1 adds authenticated, user-owned monitoring schedule rules.

- `GET/POST/PATCH/DELETE /api/monitor-schedules` manages schedules scoped to the authenticated identity subject.
- A schedule supports a bounded cadence of 1, 3, 7, 14, or 30 days.
- A schedule can target selected active monitored source IDs, or all active monitored sources when the scope is empty.
- `/api/user-monitor-scheduler` evaluates due schedules from the durable schedule store and reuses the existing evidence → history → deterministic alert pipeline.
- Schedule claims use a lease in the durable provider to reduce duplicate concurrent execution.
- The platform cron invokes the scheduler tick daily; a requested cadence is therefore a desired evaluation cadence, not an exact wall-clock execution guarantee.

### MVP 3.1 verification boundary

- Schedule normalization and due-run calculation: tested
- User schedule store isolation and limits: tested
- Authenticated schedule API owner isolation: tested
- Due scheduler source scoping and next-run advancement: tested
- Real durable schedule persistence: not verified until Supabase is exercised with the new migration
- Real production scheduler execution: not verified while the Vercel deployment blocker remains
- Exact wall-clock scheduling: not claimed

## MVP 3.2 — subscription-aware alert delivery routing

MVP 3.2 closes the routing boundary between authenticated monitoring schedules and user-owned alert subscriptions.

- User schedule execution still records evidence/history through the existing canonical recheck pipeline.
- Generated change alerts are enriched with the monitored source ID and routed only when they match the authenticated owner's active alert subscriptions.
- A routed outbox event carries `ownerId`, matching `subscriptionIds`, and `deliveryScope: "user"`.
- User-routed event keys are namespaced by owner so two users cannot collapse into the same delivery event.
- A delivery worker fails closed when the configured provider does not explicitly declare support for user-routed alerts; it does not silently send a user-scoped event to a static/global recipient.
- The existing read-only `/api/user-alerts` path remains the inbox view over recorded alerts; routing metadata does not alter evidence or deterministic alert generation.

### MVP 3.2 verification boundary

- Schedule → authenticated subscription matching: covered by deterministic tests
- User owner propagation from schedule claim into routing: covered by scheduler/store tests
- Per-owner outbox event-key isolation: implemented and covered by routing/outbox contract
- Unsupported user-routing delivery: fail-closed test coverage
- Real Supabase schedule/subscription/outbox exercise: not verified
- Real identity-provider account/session: not verified
- Real user-routed external notification delivery: not verified
- Production deployment/runtime: still blocked by the existing Vercel build-rate-limit failure

## MVP 3.0 — authenticated alert subscriptions

MVP 3.0 adds user-owned alert subscriptions on top of the existing authenticated identity boundary.

- `GET/POST/PATCH/DELETE /api/alert-subscriptions` manages subscriptions scoped to the authenticated identity subject.
- `GET /api/user-alerts` returns monitored alerts filtered by that user's active subscription rules.
- Alert categories remain the four MVP 2.9 groups: source health, availability, Philippines eligibility, and compensation.
- Optional source IDs let a subscription scope matching to selected monitored sources.
- Supabase uses the existing server-side service-role persistence boundary through `radar_alert_subscriptions`.
- Without a configured subscription provider, storage is explicitly `memory-only` and `durable:false`.
- Bearer tokens used by the static UI are kept in `sessionStorage` for the current browser session; no password flow is implemented here.

The authenticated subscription path does not alter recorded evidence or deterministic alert generation. It applies user-specific filtering after alerts are produced.

### MVP 3.0 verification boundary

- Subscription normalization and matching: tested
- User owner isolation at the store boundary: tested
- Authenticated API owner derivation/mismatch behavior: tested in the repository test contract
- Real Supabase subscription persistence: not verified until the provider is actually exercised
- Real identity-provider account/session: not verified until exercised
- Production deployment: remains blocked by the existing Vercel build-rate-limit failure

## MVP 2.9 — alert preferences

The Alert Center now supports browser-local user preferences for four evidence-change groups:

- **Source health** — source down/recovered.
- **Availability** — opened/closed/conflicting evidence.
- **Philippines eligibility** — eligible/excluded/conflicting evidence.
- **Compensation** — stated/removed/changed evidence.

Unknown future event codes are retained rather than silently discarded. Preferences only filter what the Alert Center shows; they do not change the recorded evidence or alert generation rules.

Preferences are browser-local for this MVP. Authenticated per-user subscriptions and durable notification routing remain provider-backed work.

## Next build

1. Exercise the real Supabase + identity + delivery provider path
2. Add durable source-management mutations
3. Improve opportunity ingestion/refresh beyond the current static seed
4. Add evidence freshness/recheck controls for user watch targets

## MVP 2.8 — real provider pack

MVP 2.8 adds optional direct provider adapters for the existing contracts:

- **Supabase Postgres** for durable history and alert outbox state.
- **Resend** for direct email notification delivery.

Supabase is used through its REST Data API and database RPC functions. Resend is called directly through its HTTPS email API.

### Server environment

Set these only on the server:

- `RADAR_SUPABASE_URL`
- `RADAR_SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `RADAR_ALERT_FROM`
- `RADAR_ALERT_TO`

The Supabase service-role key must never be shipped to the browser. The SQL migration enables RLS on the Radar tables and keeps them without public policies; the server adapter uses the service-role key for its private persistence boundary.

### Supabase setup

Run `supabase/mvp-2-8.sql` in the Supabase SQL editor.

The SQL creates:
- durable history records
- durable alert outbox records
- RPC functions for atomic alert claim
- RPC functions for delivered/failed lifecycle transitions

### Real exercise

The repository includes:

`node scripts/provider-exercise.js`

The script refuses to run unless:

`RADAR_PROVIDER_EXERCISE_CONFIRM=YES`

It then:
1. writes one real history record
2. reads it back
3. enqueues one real outbox event
4. runs one real delivery cycle
5. sends one real email through Resend
6. verifies the outbox event reaches `delivered`

Configuration is not the same as exercise. Only a successful real run should move those boundaries from `not_verified` to exercised in project notes.

Production deployment remains separately unverified while the existing Vercel build-rate-limit blocker remains.

## MVP 2.7 — user evidence loop

The browser UI now lets a user follow individual opportunities and inspect their recorded evidence history.

- **Watch evidence** — keep a lightweight browser-local watchlist for opportunities worth monitoring.
- **Watched only** — filter the opportunity view to the user's watched sources.
- **Evidence history** — inspect recorded checks for a source, including reachability, HTTP status, availability evidence, Philippines eligibility evidence, compensation evidence, and detected changes.
- **Lifecycle-aligned alert inbox** — the alert center reads the same active monitored-source registry used by scheduled monitoring instead of maintaining a second hardcoded source list.

The watchlist is intentionally browser-local. Account sync, durable per-user subscriptions, and external notification delivery remain separate provider-backed concerns.

## Next build

1. Exercise a real durable history + alert outbox provider
2. Exercise a real authenticated identity provider
3. Exercise a real notification provider
4. Add durable source-management mutations
5. Add user-configurable schedules


## Next build

1. Exercise a real durable history + alert outbox provider
2. Exercise a real authenticated identity provider
3. Exercise a real notification provider
4. Add durable source management mutations
5. Add user-configurable schedules
