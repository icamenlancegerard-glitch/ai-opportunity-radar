# AI Opportunity Radar

**MVP 0.5 — evidence-first AI opportunity discovery**

AI Opportunity Radar is a lightweight web prototype for finding AI-related work opportunities while keeping uncertainty visible.

## Current MVP
- Search by title, company, skill, or location
- Filter by opportunity type and work mode
- Evidence-status badges
- Freshness status based on the recorded `lastChecked` date
- Direct source links
- Safe, allowlisted server-side source reachability recheck
- Mobile-friendly UI
- Explicit distinction between source evidence, freshness, and confirmed availability
- 13 research records: 10 source-recorded and 3 marked INVESTIGATE

## Evidence rule
“Source recorded” means a direct source URL is stored and was checked on the date shown. It does **not** establish that an opportunity is current, that the employer is verified, that pay is accurate, or that the user is eligible.

The **Recheck source** action only tests whether an allowlisted source URL responds. A successful HTTP response is **not** treated as confirmation that a job is open or accepting applications.

## Freshness rule
- **Fresh:** 0–1 days since last check
- **Aging:** 2–3 days
- **Stale:** 4+ days
- **Unknown:** missing or invalid check date

Freshness is a prioritization signal, not a truth claim.

## Next build
1. Persistent recheck history
2. Scheduled freshness jobs
3. Source-specific availability detection
4. Deduplication and canonical-source matching
5. Philippines eligibility rules
6. Saved searches and alerts
7. Optional paid tier

## Separation
This project is separate from AI HITS and does not modify the AI HITS repositories.
