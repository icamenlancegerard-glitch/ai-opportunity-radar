# AI Opportunity Radar

**MVP 1.6 — canonical, evidence-first AI opportunity discovery**

AI Opportunity Radar is a lightweight web prototype for finding AI-related work opportunities while keeping uncertainty visible.

## Current MVP
- Search by title, company, skill, or location
- Filter by opportunity type and work mode
- Evidence-status badges
- Freshness status based on the recorded `lastChecked` date
- Direct source links
- Shared, allowlisted server-side source policy
- Canonical recheck pipeline: source policy → bounded content → availability evidence → snapshot → history → change detection → opportunity status
- Mobile-friendly UI
- Explicit distinction between source evidence, freshness, reachability, availability evidence, and confirmed availability
- 13 research records: 10 source-recorded and 3 marked INVESTIGATE

## MVP 1.6 evidence boundary
Availability is represented as an evidence state:
- **OPEN_EVIDENCE:** explicit open/apply language found in bounded page text
- **CLOSED_EVIDENCE:** explicit closed/unavailable language found in bounded page text
- **CONFLICTING_EVIDENCE:** both open and closed signals found
- **NOT_VERIFIED:** no sufficiently explicit signal, unsupported source, missing content, or non-success HTTP response

An HTTP 200 response by itself never becomes an availability claim. Error/5xx pages are not parsed as job-availability evidence.

All recheck paths use the same allowlisted HTTPS source policy. URL fragments are normalized away before history is recorded. Redirects are not automatically followed.

The canonical pipeline captures at most 32 KiB of response text for deterministic evidence classification. Raw page content is not persisted by the evidence module; only normalized evidence status and matched signal labels enter the snapshot/history record.

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
3. Philippines eligibility rules
4. Saved searches and alerts
5. Optional paid tier

## Separation
This project is separate from AI HITS and does not modify the AI HITS repositories.
