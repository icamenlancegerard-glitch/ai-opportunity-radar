// MVP 2.3 — deterministic alert outbox boundary.
// The outbox records alerts for later delivery. It does not itself send email,
// push, SMS, or other external notifications unless an HTTPS provider is configured.

function normalizeAlert(alert) {
  if (!alert || typeof alert !== 'object') throw new Error('Alert is required');
  const code = typeof alert.code === 'string' ? alert.code.trim() : '';
  const url = typeof alert.url === 'string' ? alert.url.trim() : '';
  const checkedAt = typeof alert.checkedAt === 'string' ? alert.checkedAt.trim() : '';
  if (!code || !url || !checkedAt) throw new Error('Alert code, url, and checkedAt are required');
  return {
    ...alert,
    eventKey: `${code}|${url}|${checkedAt}`,
    status: alert.status === 'delivered' ? 'delivered' : 'queued'
  };
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
    async list() {
      return [...events.values()];
    },
    async markDelivered(eventKey) {
      const existing = events.get(eventKey);
      if (!existing) return null;
      const updated = { ...existing, status: 'delivered' };
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
    async list() {
      const data = await request('/events');
      return Array.isArray(data.events) ? data.events : [];
    },
    async markDelivered(eventKey) {
      const data = await request(`/events/${encodeURIComponent(eventKey)}/delivered`, {
        method: 'POST',
        body: JSON.stringify({ eventKey })
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
    provider: 'HTTPS JSON alert outbox'
  };
}

module.exports = {
  normalizeAlert,
  createMemoryAlertOutbox,
  createHttpAlertOutbox,
  getAlertOutbox,
  getAlertOutboxStatus
};
