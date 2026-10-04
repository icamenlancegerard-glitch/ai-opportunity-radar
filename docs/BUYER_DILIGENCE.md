# Buyer Diligence Snapshot

**Project:** AI Opportunity Radar  
**Snapshot date:** 2026-10-04  
**Review branch:** `sale-readiness-cleanup`  
**Production commit reviewed:** `dd4cb6a2dd5ec120e7914becdec93e7646ed9e24`

## Product status

AI Opportunity Radar is an evidence-first web application for discovering AI-related work opportunities, inspecting bounded source evidence, tracking evidence freshness, recording source history, and generating deterministic change-alert events.

The current production deployment is live on Vercel. The runtime status endpoint has been directly verified at HTTP 200 with `ok: true`.

## Verified production capabilities

- Evidence classification for availability, Philippines eligibility, and compensation is implemented.
- Canonical source-policy and recheck pipeline is implemented.
- Five monitored source records are configured and active.
- Supabase Postgres durable history is configured.
- Durable alert outbox state is configured.
- Scheduled monitoring is configured.
- Authenticated alert-subscription storage and user monitoring schedule storage are configured.
- Source policy requires HTTPS, blocks embedded credentials, and uses an allowlist.

## Explicit non-verified / non-configured boundaries

The following must not be represented to a buyer as fully operational in the current production environment:

- Production identity/authentication provider — **not configured**
- External alert delivery — **not configured**
- Real user-routed external notification delivery — **not verified**
- Current job availability truth — **not verified**
- Current Philippines eligibility truth — **not verified**
- Current compensation truth — **not verified**
- Continued hiring status — **not verified**

The production session endpoint currently returns `503 IDENTITY_PROVIDER_NOT_CONFIGURED`. The alert inbox is read-only and does not send external notifications.

## Evidence freshness

The seeded opportunity corpus contains records last checked on 2026-09-17. Current durable monitoring history is limited; some monitored sources have no stored history and one verified history record returned HTTP 401 with evidence fields remaining `NOT_VERIFIED`.

Therefore the product should be demonstrated as an **evidence and monitoring framework**, not as a guarantee that every displayed opportunity is currently open, eligible, or hiring.

## Testing

The repository contains deterministic regression tests covering the history engine/store, recheck pipeline, availability evidence, Philippines eligibility, compensation evidence, source policy, alerts, alert outbox/delivery/routing, identity/session boundaries, monitored sources, monitoring, schedules, subscriptions, and provider adapters.

The latest Vercel deployment has a successful Vercel commit status. A complete fresh execution of the entire repository test suite has not been established by this snapshot and should be run as a final handoff check.

## Deployment

Current production deployment:

- Vercel deployment: `dpl_C4t53R8nFPFNe6CzLmxkmX3onXJY`
- State: `READY`
- Branch: `main`
- Commit: `dd4cb6a2dd5ec120e7914becdec93e7646ed9e24`

The review branch does not represent the current production deployment and is intentionally kept separate so cleanup changes do not trigger production deployment.

## IP / repository disclosure

The GitHub repository is currently **public** and has no repository-level license declaration.

A sale agreement must explicitly define:

1. Which current code, configuration, documentation, deployment assets, and project records are included.
2. Which intellectual property is excluded from the transaction, including the AI HITS / HITS Gate / Dynamo systems and their separate repositories.
3. That the repository's historical public visibility is disclosed.
4. Whether the buyer receives assignment, license, or another agreed right, subject to applicable legal review.

No claim of exclusive confidentiality or exclusive rights should be made solely from repository ownership.

## Buyer handoff requirements

Before final transfer, the seller should provide a controlled handoff containing:

- Vercel project transfer/access procedure
- Supabase project/schema setup
- Required server environment-variable names and purposes, without exposing secret values in public documentation
- Cron paths and schedules
- Provider boundary contracts
- Test/run instructions
- Current production verification snapshot
- Explicit list of configured versus unconfigured providers
- Written IP/exclusion schedule separating Radar from AI HITS/Dynamo

## Known runtime technical debt

Vercel runtime logs currently show Node's `DEP0169` deprecation warning associated with `url.parse()` on `/api/history` and `/api/recheck-one`. This is a warning-level cleanup item, not a current production outage.

## Sale posture

The strongest defensible positioning is:

> **An evidence-first AI opportunity monitoring asset with live production deployment, durable history/outbox infrastructure, scheduled monitoring, deterministic change detection, and a clear path to complete identity and notification provider integration.**

Avoid positioning it as a fully operational authenticated SaaS with live external alert delivery until those provider boundaries are actually configured and exercised.
