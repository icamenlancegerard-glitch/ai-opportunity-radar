# AI Opportunity Radar — MVP 1.3 Plan

## Goal
Turn the verified 1.2 diagnostics capability into a user-visible runtime health surface without adding a paid durable storage dependency.

## Scope
- Add a read-only `/api/status` endpoint that reports service version, history capability, storage mode, and explicit verification limitations.
- Keep memory-only storage honest: no durable persistence claim.
- Add a small UI status panel that calls `/api/status` and displays API/runtime state.
- Keep opportunity/job availability separate from system health.

## Evidence gates
1. GitHub source exists.
2. Vercel deployment reports success.
3. `/api/status` returns HTTP 200 with `ok: true`.
4. UI displays the returned status without fabricating job availability.

## Non-goals
- No paid database or storage provider.
- No claim that a source/job is currently hiring solely from system health.
- No automatic changes to AI HITS Dynamo.
