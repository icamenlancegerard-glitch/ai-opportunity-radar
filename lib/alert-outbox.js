// MVP 2.8 — durable alert lifecycle boundary with optional Supabase REST/RPC durability.
// Queued events can be claimed, delivered, retried, or terminally failed.
// A provider is required for cross-invocation durability; memory mode remains a test/local fallback.

function normalizeAlert(alert) {
  if (!alert || typeof alert !== 'object') throw new Error('Alert is required');
  const code = typeof alert.code === 'string' ? alert.code.trim() : '';
  const url = typeof alert.url === 'string' ? alert.url.trim() : '';
  const checkedAt = typeof alert.checkedAt === 'string' ? alert.checkedAt.trim() : '';
  if (!code || !url || !checkedAt) throw new Error('Alert code, url, and checkedAt are required');

  const attempts = Number.isInteger(alert.attempts) && alert.attempts >= 0 ? alert.attempts : 0;
  const status = ['queued', 'delivering', 'retry', 'delivered', 'failed'].includes(alert.status)
    ? alert.status
    : 'queued';

  const ownerId = typeof alert.ownerId === 'string' ? alert.ownerId.trim() : '';
  const baseEventKey = `${code}|${url}|${checkedAt}`;
  // User-routed events need per-owner idempotency. Legacy/global events keep
  // the original key shape for backward compatibility.
  const eventKey = ownerId
    ? `user:${encodeURIComponent(ownerId)}|${baseEventKey}`
    : baseEventKey;

  return {
    ...alert,
    ownerId: ownerId || undefined,
    subscriptionIds: Array.isArray(alert.subscriptionIds)
      ? [...new Set(alert.subscriptionIds.filter(id => typeof id === 'string' && id.trim()).map(id => id.trim()))]
      : [],
    eventKey,
    status,
    attempts,
    createdAt: typeof alert.createdAt === 'string' ? alert.createdAt : new Date().toISOString(),
    nextAttemptAt: typeof alert.nextAttemptAt === 'string' ? alert.nextAttemptAt : null,
    leaseUntil: typeof alert.leaseUntil === 'string' ? alert.leaseUntil : null,
    lastError: typeof alert.lastError === 'string' ? alert.lastError : null,
    deliveredAt: typeof alert.deliveredAt === 'string' ? alert.deliveredAt : null
  };
}

function isDue(event, now = new Date()) {
  if (!event.nextAttemptAt) return true;
  const due = Date.parse(event.nextAttemptAt);
  return Number.isNaN(due) || due <= now.getTime();
}

function leaseExpired(event, now = new Date()) {
  if (!event.leaseUntil) return true;
  const lease = Date.parse(event.leaseUntil);
  return Number.isNaN(lease) || lease <= now.getTime();
}

function createMemoryAlertOutbox() {
  const events = new Map();

  return {
    storage: 'memory-only',
    durable: false,

    async enqueue(alert) {
      const normalized = normalizeAlert(alert);
      if (!events.has(normalized.eventKey)) events.set(normalized.eventKey, normalized);
      return events.get(normalized.eventKey);
    },

    async list({ statuses, now = new Date() } = {}) {
      const allowed = Array.isArray(statuses) && statuses.length ? new Set(statuses) : null;
      return [...events.values()].filter(event => {
        if (allowed && !allowed.has(event.status)) return false;
        if (event.status === 'retry') return isDue(event, now);
        if (event.status === 'delivering') return leaseExpired(event, now);
        return true;
      });
    },

    async claim(eventKey, { leaseUntil, now = new Date() } = {}) {
      const existing = events.get(eventKey);
      if (!existing) return null;

      const claimable =
        existing.status === 'queued' ||
        (existing.status === 'retry' && isDue(existing, now)) ||
        (existing.status === 'delivering' && leaseExpired(existing, now));

      if (!claimable) return null;

      const updated = {
        ...existing,
        status: 'delivering',
        attempts: existing.attempts + 1,
        leaseUntil: leaseUntil || new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
        nextAttemptAt: null,
        lastError: null
      };
      events.set(eventKey, updated);
      return updated;
    },

    async markDelivered(eventKey, { now = new Date() } = {}) {
      const existing = events.get(eventKey);
      if (!existing) return null;

      const updated = {
        ...existing,
        status: 'delivered',
        deliveredAt: now.toISOString(),
        leaseUntil: null,
        nextAttemptAt: null,
        lastError: null
      };
      events.set(eventKey, updated);
      return updated;
    },

    async markFailed(eventKey, { error, nextAttemptAt = null, maxAttempts = 3 } = {}) {
      const existing = events.get(eventKey);
      if (!existing) return null;

      const terminal = existing.attempts >= maxAttempts;
      const updated = {
        ...existing,
        status: terminal ? 'failed' : 'retry',
        leaseUntil: null,
        nextAttemptAt: terminal ? null : nextAttemptAt,
        lastError: typeof error === 'string' ? error.slice(0, 2000) : 'delivery failed'
      };
      events.set(eventKey, updated);
      return updated;
    }
  };
}

function createHttpAlertOutbox({ baseUrl, token } = {}) {
  const parsed = new URL(baseUrl);
  if (parsed.protocol !== 'https:') {
    const error = new Error('Alert outbox provider must use HTTPS');
    error.code = 'PROVIDER_INVALID';
    error.statusCode = 503;
    throw error;
  }

  async function request(path, options = {}) {
    const response = await fetch(new URL(path, parsed), {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      }
    });

    if (!response.ok) {
      const error = new Error(`Alert outbox provider returned HTTP ${response.status}`);
      error.code = 'PROVIDER_HTTP_ERROR';
      error.statusCode = 502;
      throw error;
    }

    const text = await response.text();
    if (!text) return {};
    try { return JSON.parse(text); }
    catch (_) {
      const error = new Error('Alert outbox provider returned invalid JSON');
      error.code = 'PROVIDER_INVALID_JSON';
      error.statusCode = 502;
      throw error;
    }
  }

  function eventsPath({ statuses } = {}) {
    const query = new URLSearchParams();
    if (Array.isArray(statuses) && statuses.length) query.set('status', statuses.join(','));
    return query.toString() ? `/events?${query}` : '/events';
  }

  return {
    storage: 'http-durable',
    durable: true,

    async enqueue(alert) {
      const normalized = normalizeAlert(alert);
      const data = await request('/events', {
        method: 'POST',
        body: JSON.stringify({ event: normalized })
      });
      return data.event || normalized;
    },

    async list(options = {}) {
      const data = await request(eventsPath(options));
      return Array.isArray(data.events) ? data.events : [];
    },

    async claim(eventKey, { leaseUntil, now = new Date() } = {}) {
      const data = await request(`/events/${encodeURIComponent(eventKey)}/claim`, {
        method: 'POST',
        body: JSON.stringify({
          eventKey,
          leaseUntil: leaseUntil || new Date(now.getTime() + 5 * 60 * 1000).toISOString()
        })
      });
      return data.event || null;
    },

    async markDelivered(eventKey) {
      const data = await request(`/events/${encodeURIComponent(eventKey)}/delivered`, {
        method: 'POST',
        body: JSON.stringify({ eventKey })
      });
      return data.event || null;
    },

    async markFailed(eventKey, { error, nextAttemptAt, maxAttempts = 3 } = {}) {
      const data = await request(`/events/${encodeURIComponent(eventKey)}/failed`, {
        method: 'POST',
        body: JSON.stringify({ eventKey, error, nextAttemptAt, maxAttempts })
      });
      return data.event || null;
    }
  };
}

function createSupabaseAlertOutbox({ client }) {
  function rowToEvent(row) {
    return row?.payload
      ? {
          ...row.payload,
          eventKey: row.event_key,
          status: row.status,
          attempts: row.attempts,
          createdAt: row.created_at,
          nextAttemptAt: row.next_attempt_at,
          leaseUntil: row.lease_until,
          lastError: row.last_error,
          deliveredAt: row.delivered_at
        }
      : null;
  }

  return {
    storage: 'supabase-postgres',
    durable: true,

    async enqueue(alert) {
      const normalized = normalizeAlert(alert);
      const row = {
        event_key: normalized.eventKey,
        code: normalized.code,
        severity: normalized.severity || 'info',
        title: normalized.title || normalized.code,
        url: normalized.url,
        checked_at: normalized.checkedAt,
        source_url: normalized.sourceUrl || normalized.url,
        status: normalized.status,
        attempts: normalized.attempts,
        created_at: normalized.createdAt,
        next_attempt_at: normalized.nextAttemptAt,
        lease_until: normalized.leaseUntil,
        last_error: normalized.lastError,
        delivered_at: normalized.deliveredAt,
        payload: normalized
      };
      const rows = await client.request('/radar_alert_events', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(row)
      });
      return rowToEvent(Array.isArray(rows) ? rows[0] : null) || normalized;
    },

    async list({ statuses, now = new Date() } = {}) {
      const allowed = Array.isArray(statuses) && statuses.length ? statuses.join(',') : '';
      const suffix = allowed ? '?status=in.(' + allowed + ')&order=created_at.asc' : '?order=created_at.asc';
      const rows = await client.request('/radar_alert_events' + suffix, { method: 'GET' });
      return (Array.isArray(rows) ? rows : [])
        .map(rowToEvent)
        .filter(Boolean)
        .filter(event => {
          if (event.status === 'retry') return isDue(event, now);
          if (event.status === 'delivering') return leaseExpired(event, now);
          return true;
        });
    },

    async claim(eventKey, { leaseUntil, now = new Date() } = {}) {
      const rows = await client.request('/rpc/radar_claim_alert_event', {
        method: 'POST',
        body: JSON.stringify({
          p_event_key: eventKey,
          p_lease_until: leaseUntil || new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
          p_now: now.toISOString()
        })
      });
      return rowToEvent(Array.isArray(rows) ? rows[0] : null);
    },

    async markDelivered(eventKey, { now = new Date() } = {}) {
      const rows = await client.request('/rpc/radar_mark_alert_delivered', {
        method: 'POST',
        body: JSON.stringify({ p_event_key: eventKey, p_now: now.toISOString() })
      });
      return rowToEvent(Array.isArray(rows) ? rows[0] : null);
    },

    async markFailed(eventKey, { error, nextAttemptAt, maxAttempts = 3 } = {}) {
      const rows = await client.request('/rpc/radar_mark_alert_failed', {
        method: 'POST',
        body: JSON.stringify({
          p_event_key: eventKey,
          p_error: error,
          p_next_attempt_at: nextAttemptAt || null,
          p_max_attempts: maxAttempts
        })
      });
      return rowToEvent(Array.isArray(rows) ? rows[0] : null);
    }
  };
}

function getConfiguredAlertOutbox() {
  const supabase = require('./supabase-rest').getConfiguredSupabaseClient();
  if (supabase) return createSupabaseAlertOutbox({ client: supabase });

  const url = process.env.RADAR_ALERT_OUTBOX_URL;
  if (!url) return null;

  try {
    return createHttpAlertOutbox({
      baseUrl: url,
      token: process.env.RADAR_ALERT_OUTBOX_TOKEN || ''
    });
  } catch (_) {
    return null;
  }
}

function getAlertOutbox() {
  return getConfiguredAlertOutbox() || createMemoryAlertOutbox();
}

function getAlertOutboxStatus() {
  const configured = Boolean(getConfiguredAlertOutbox());
  return {
    storage: configured ? 'http-durable' : 'memory-only',
    durable: configured,
    configured,
    provider: 'HTTPS JSON alert outbox',
    lifecycle: 'queued|delivering|retry|delivered|failed'
  };
}

module.exports = {
  normalizeAlert,
  createMemoryAlertOutbox,
  createHttpAlertOutbox,
  createSupabaseAlertOutbox,
  getAlertOutbox,
  getAlertOutboxStatus
};
