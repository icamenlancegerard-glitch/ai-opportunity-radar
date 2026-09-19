# AI Opportunity Radar

**MVP 1.9 — canonical, evidence-first AI opportunity discovery**

AI Opportunity Radar is a lightweight web prototype for finding AI-related work opportunities while keeping uncertainty visible.

## Current MVP
- Search by title, company, skill, or location
- Filter by opportunity type and work mode
- Evidence-status badges
- Freshness status based on recorded `lastChecked`
- Direct source links
- Shared, allowlisted server-side source policy
- Canonical recheck pipeline: source policy → bounded content → availability evidence → PH eligibility evidence → compensation evidence → snapshot → history → change detection → opportunity status
- Mobile-friendly UI
- Explicit separation between source evidence, freshness, reachability, availability evidence, PH eligibility evidence, compensation evidence, and final claims
- Durable-history provider boundary with an honest memory fallback

## MVP 1.9 durable history boundary
The history store now supports a configured HTTPS persistence provider.

When `HISTORY_STORE_URL` is present and valid:
- history reads use the provider's `/latest` and `/records` endpoints
- history appends use `POST /records`
- `HISTORY_STORE_TOKEN` is sent as a Bearer token when present
- runtime status reports `storage: http-durable` and `durable: true`

When no valid provider is configured:
- runtime remains `storage: memory-only`
- `durable: false`
- no durable-persistence claim is made

Provider contract:
- `GET /latest?url=<encoded-url>` → `{ "record": ... }`
- `GET /records?url=<encoded-url>` → `{ "records": [...] }`
- `GET /records` → `{ "records": [...] }`
- `POST /records` with `{ "record": ... }` → `{ "record": ... }`

The adapter intentionally does not claim what database or storage technology backs the provider. Connecting a real provider is a deployment configuration step.

## Evidence boundary
PH eligibility is evidence:
- **PH_ELIGIBLE_EVIDENCE:** explicit applicant/location language says the opportunity is available to people based in or residing in the Philippines
- **PH_EXCLUDED_EVIDENCE:** explicit language excludes Philippine applicants or requires another jurisdiction
- **CONFLICTING_EVIDENCE:** eligible and excluded signals both appear
- **NOT_VERIFIED:** no sufficiently explicit applicant/location signal, missing content, unsupported source, or non-success HTTP response

A generic mention of "Philippines", a Philippine office, a job's physical location, or an employer's market does **not** establish applicant eligibility.

Compensation is evidence only when bounded source text contains an explicit currency + amount/range + payment unit such as per hour or per month. Vague language remains **NOT_VERIFIED**.

An HTTP 200 response by itself never becomes an availability, eligibility, or compensation claim. Error/5xx pages are not parsed as job evidence.

The pipeline captures at most 32 KiB of response text. Raw page content is not persisted by the evidence modules; only normalized evidence states and matched signal labels enter history.

## Freshness rule
- **Fresh:** 0–1 days since last check
- **Aging:** 2–3 days
- **Stale:** 4+ days
- **Unknown:** missing or invalid check date

Freshness is a prioritization signal, not a truth claim.

## Next build
1. Connect a real durable history provider
2. URL canonicalization beyond fragment normalization and deduplication
3. Saved searches and alerts
4. Optional paid tier

## Separation
This project is separate from AI HITS and does not modify the AI HITS repositories.
