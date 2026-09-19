# AI Opportunity Radar

**MVP 1.7 — canonical, evidence-first AI opportunity discovery**

AI Opportunity Radar is a lightweight web prototype for finding AI-related work opportunities while keeping uncertainty visible.

## Current MVP
- Search by title, company, skill, or location
- Filter by opportunity type and work mode
- Evidence-status badges
- Freshness status based on recorded \`lastChecked\`
- Direct source links
- Shared, allowlisted server-side source policy
- Canonical recheck pipeline: source policy → bounded content → availability evidence → PH eligibility evidence → snapshot → history → change detection → opportunity status
- Mobile-friendly UI
- Explicit separation between source evidence, freshness, reachability, availability evidence, PH eligibility evidence, and final claims

## MVP 1.7 evidence boundary
PH eligibility is represented as evidence:
- **PH_ELIGIBLE_EVIDENCE:** explicit applicant/location language says the opportunity is available to people based in or residing in the Philippines
- **PH_EXCLUDED_EVIDENCE:** explicit language excludes Philippine applicants or requires another jurisdiction
- **CONFLICTING_EVIDENCE:** eligible and excluded signals both appear
- **NOT_VERIFIED:** no sufficiently explicit applicant/location signal, missing content, unsupported source, or non-success HTTP response

A generic mention of "Philippines", a Philippine office, a job's physical location, or an employer's market does **not** establish applicant eligibility.

An HTTP 200 response by itself never becomes an availability or eligibility claim. Error/5xx pages are not parsed as job evidence.

The pipeline captures at most 32 KiB of response text. Raw page content is not persisted by the evidence modules; only normalized evidence states and matched signal labels enter history.

Persistent storage is still **not configured**; current history remains process-local.

## Freshness rule
- **Fresh:** 0–1 days since last check
- **Aging:** 2–3 days
- **Stale:** 4+ days
- **Unknown:** missing or invalid check date

Freshness is a prioritization signal, not a truth claim.

## Next build
1. Durable history persistence
2. URL canonicalization beyond fragment normalization and deduplication
3. Compensation evidence
4. Saved searches and alerts
5. Optional paid tier

## Separation
This project is separate from AI HITS and does not modify the AI HITS repositories.
