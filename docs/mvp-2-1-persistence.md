# MVP 2.1 — Server-Side Saved-Search Persistence

MVP 2.1 adds a server-side saved-search API while keeping identity and durability claims explicit.

## Runtime contract

`api/saved-searches.js` supports:

- `GET` — list saved searches for an owner
- `POST` — add or replace a saved search by case-insensitive name
- `DELETE` — remove a saved search by name

The API accepts the owner identifier from `X-Radar-User-Id` or `ownerId`.

This identifier is **client-supplied**. MVP 2.1 does not authenticate or authorize the caller.

## Validation

Saved searches use the existing normalized schema:

- name: required, max 60 characters
- query: max 120 characters
- type: max 40 characters
- mode: max 40 characters
- location: max 80 characters
- maximum 10 saved searches per owner

## Storage

Environment variables:

- `RADAR_SAVED_SEARCH_STORE_URL` — optional HTTPS JSON provider
- `RADAR_SAVED_SEARCH_STORE_TOKEN` — optional bearer token

Provider contract:

- `GET /saved-searches?ownerId=<id>` → `{ "searches": [...] }`
- `PUT /saved-searches` with `{ "ownerId": "...", "searches": [...] }`

Without a valid HTTPS provider the runtime falls back to memory-only storage and reports `durable: false`.

No database, authentication service, or external notification system is claimed to be configured by this MVP.

## Next hardening

A production deployment should add authenticated user identity before treating owner IDs as security boundaries, and then connect a real durable provider with atomic per-owner updates.
