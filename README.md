# AI Opportunity Radar

**MVP 1.5 — canonical, evidence-first AI opportunity discovery**

AI Opportunity Radar is a lightweight web prototype for finding AI-related work opportunities while keeping uncertainty visible.

## Current MVP
- Search by title, company, skill, or location
- Filter by opportunity type and work mode
- Evidence-status badges
- Freshness status based on the recorded \`lastChecked\` date
- Direct source links
- Shared, allowlisted server-side source policy
- Canonical recheck pipeline: source policy → snapshot → history → change detection → opportunity status
- Mobile-friendly UI
- Explicit distinction between source evidence, freshness, and confirmed availability
- 13 research records: 10 source-recorded and 3 marked INVESTIGATE

## MVP 1.5 evidence boundary
A source can be **reachable** without an opportunity being confirmed as open, eligible, paid at the stated rate, or actively hiring.

All recheck paths use the same allowlisted HTTPS source policy. URL fragments are normalized away before history is recorded. Redirects are not automatically followed by the recheck fetch.

The canonical recheck pipeline records a snapshot, compares it with the previous snapshot, and derives source/change status. Persistent storage is still **not configured**; current history remains process-local.

## Freshness rule
- **Fresh:** 0–1 days since last check
- **Aging:** 2–3 days
- **Stale:** 4+ days
- **Unknown:** missing or invalid check date

Freshness is a prioritization signal, not a truth claim.

## Next build
1. Durable history persistence
2. Source-specific availability evidence
3. URL canonicalization beyond fragment normalization and deduplication
4. Philippines eligibility rules
5. Saved searches and alerts
6. Optional paid tier

## Separation
This project is separate from AI HITS and does not modify the AI HITS repositories.
