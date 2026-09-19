# AI Opportunity Radar

**MVP 2.0 — evidence-first opportunity monitoring**

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
