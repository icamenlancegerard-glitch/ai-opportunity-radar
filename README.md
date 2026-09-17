# AI Opportunity Radar

**MVP 0.4 — evidence-first AI opportunity discovery**

AI Opportunity Radar is a lightweight web prototype for finding AI-related work opportunities while keeping uncertainty visible.

## Current MVP
- Search by title, company, skill, or location
- Filter by opportunity type
- Filter by work mode, including unclear work setup
- Evidence-status badges
- Direct source links
- Last-checked, freshness, and eligibility fields
- Responsive mobile-friendly UI
- Explicit separation between source evidence and current availability
- 13 research records in the bundled dataset: 10 source-recorded and 3 marked INVESTIGATE

## Evidence rule
The bundled records were checked against public web sources on **2026-09-17**. “Source recorded” means a direct source URL is stored and the source was checked on the date shown. It does **not** establish that an opportunity remains open, that the employer will accept an application, that compensation will be exactly as listed, or that a user is eligible.

Records are deliberately marked **INVESTIGATE** when application status or work setup is unclear. The Radar does not convert missing evidence into certainty.

## Current source examples
The MVP dataset includes public postings or source hubs from Productive Playhouse, Hired Philippines, RWS, TELUS Digital, Meridial, ARGOS MULTILINGUAL, TaskUs, DataAnnotation, and MCI.

## Next build
1. Automated source refresh and re-check timestamps
2. Deduplication by normalized title/company/source URL
3. Philippines eligibility and remote-only filters
4. Closed/stale detection rules
5. Saved searches and alerts
6. Optional paid curated opportunity briefs

## Separation
This project is separate from AI HITS and does not modify the AI HITS repositories.
