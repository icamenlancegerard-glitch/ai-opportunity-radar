// MVP 2.5 — durable alert lifecycle boundary.
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

  return {
    ...alert,
    eventKey: `${code}|${url}|${checkedAt}`,
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

function getConfiguredAlertOutbox() {
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
  getAlertOutbox,
  getAlertOutboxStatus
};
