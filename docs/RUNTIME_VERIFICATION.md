# Runtime Verification Note

## Current verification snapshot — 2026-10-04

The current production deployment is **runtime-verified for basic service execution**, with explicit limits on identity, notification delivery, and source evidence freshness.

### Production deployment

- Project: `ai-opportunity-radar`
- Environment: production
- Latest production deployment: `dpl_C4t53R8nFPFNe6CzLmxkmX3onXJY`
- Deployment state: `READY`
- Current production commit: `dd4cb6a2dd5ec120e7914becdec93e7646ed9e24`
- Commit: `fix: surface discovery triage filter when candidates exist`

### Live runtime checks

`GET /api/status` returned HTTP 200 with `ok: true`.

The runtime reports:

- evidence classifiers available
- change-alert engine available
- canonical pipeline available
- 5 monitored sources configured and active
- HTTPS-only source policy with credentials blocked
- Supabase Postgres durable storage configured
- durable alert outbox configured
- scheduled monitoring configured
- user monitoring schedule storage configured
- authenticated alert subscription storage configured

### Explicit non-verified boundaries

The following are **not** currently claimed as fully operational:

- authenticated identity provider — **not configured**
- external alert delivery — **not configured**
- real user-routed notification delivery — **not verified**
- job availability truth — **not verified**
- Philippines eligibility truth — **not verified**
- compensation truth — **not verified**
- hiring status / continued availability — **not verified**

The live `/api/session` endpoint currently returns `503 IDENTITY_PROVIDER_NOT_CONFIGURED`. The live alert inbox is read-only and does not send external notifications.

### Durable history evidence

The live history endpoint confirms that the deployed application can read from the configured durable Supabase-backed history provider.

Current monitored-source history is limited. One Indeed source has a recorded check returning HTTP 401 with availability, eligibility, and compensation all `NOT_VERIFIED`; several monitored sources currently have no stored history record. This means the monitoring infrastructure is configured, but current marketplace evidence should not be presented as freshly verified without another successful source recheck.

### Documentation boundary

Earlier sections of this repository contained verification notes from a period when Vercel runtime access returned HTTP 403. Those historical statements are retained only as historical context and should not be interpreted as the current production state.

### Buyer diligence note

The GitHub repository is currently public and has no repository-level license declaration. Any asset transfer or exclusivity claim therefore requires an explicit written transaction boundary; public repository history should be disclosed rather than implied away.

## Historical verification record

Earlier verification notes are preserved below for traceability.

- GitHub `main` contains the history-engine null-safety fix and regression coverage.
- Earlier Vercel integration access reported HTTP 403 for runtime inspection.
- Those earlier observations established a conservative `DEPLOYED_UNVERIFIED_RUNTIME` status at that time.

No historical verification note overrides the current snapshot above.
