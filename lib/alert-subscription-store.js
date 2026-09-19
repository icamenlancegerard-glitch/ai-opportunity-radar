// MVP 3.0 — authenticated per-user alert subscription persistence.
// Supabase is preferred when the existing Radar durable provider is configured.
// Memory remains an explicit non-durable fallback for tests/local execution.
// Every store operation is scoped by the authenticated owner id supplied by the API.

const {
  MAX_ALERT_SUBSCRIPTIONS,
  normalizeSubscription,
  validateSubscriptionInput
} = require('./alert-subscriptions');
const { normalizeOwnerId } = require('./saved-search-store');

function createMemoryAlertSubscriptionStore() {
  const records = new Map();

  return {
    storage: 'memory-only',
    durable: false,

    async list(ownerId) {
      const key = normalizeOwnerId(ownerId);
      return (records.get(key) || []).map(item => ({ ...item }));
    },

    async create(ownerId, input) {
      const key = normalizeOwnerId(ownerId);
      const current = records.get(key) || [];
      if (current.length >= MAX_ALERT_SUBSCRIPTIONS) {
        const error = new Error('Maximum alert subscriptions reached');
        error.code = 'SUBSCRIPTION_LIMIT_REACHED';
        error.statusCode = 409;
        throw error;
      }

      const subscription = validateSubscriptionInput(input);
      const next = {
        ...subscription,
        ownerId: undefined
      };
      const stored = normalizeSubscription(next);
      records.set(key, [...current, stored]);
      return { ...stored };
    },

    async update(ownerId, subscriptionId, input) {
      const key = normalizeOwnerId(ownerId);
      const current = records.get(key) || [];
      const index = current.findIndex(item => item.id === subscriptionId);
      if (index === -1) return null;

      const existing = current[index];
      const next = normalizeSubscription({
        ...existing,
        ...input,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString()
      });

      const updated = [...current];
      updated[index] = next;
      records.set(key, updated);
      return { ...next };
    },

    async remove(ownerId, subscriptionId) {
      const key = normalizeOwnerId(ownerId);
      const current = records.get(key) || [];
      const next = current.filter(item => item.id !== subscriptionId);
      if (next.length === current.length) return false;
      records.set(key, next);
      return true;
    }
  };
}

function createHttpAlertSubscriptionStore({ baseUrl, token = '' } = {}) {
  const parsed = new URL(baseUrl);
  if (parsed.protocol !== 'https:') {
    const error = new Error('Alert subscription provider must use HTTPS');
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
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(options.headers || {})
      }
    });

    let body = {};
    try { body = await response.json(); } catch (_) {}

    if (!response.ok) {
      const error = new Error(body?.error || ('Alert subscription provider returned HTTP ' + response.status));
      error.code = body?.code || 'PROVIDER_HTTP_ERROR';
      error.statusCode = 502;
      throw error;
    }

    return body || {};
  }

  return {
    storage: 'http-durable',
    durable: true,

    async list(ownerId) {
      const key = normalizeOwnerId(ownerId);
      const data = await request('/alert-subscriptions?ownerId=' + encodeURIComponent(key));
      return Array.isArray(data.subscriptions) ? data.subscriptions.map(normalizeSubscription) : [];
    },

    async create(ownerId, input) {
      const key = normalizeOwnerId(ownerId);
      const subscription = validateSubscriptionInput(input);
      const data = await request('/alert-subscriptions', {
        method: 'POST',
        body: JSON.stringify({ ownerId: key, subscription })
      });
      return normalizeSubscription(data.subscription || subscription);
    },

    async update(ownerId, subscriptionId, input) {
      const key = normalizeOwnerId(ownerId);
      const data = await request('/alert-subscriptions/' + encodeURIComponent(subscriptionId), {
        method: 'PATCH',
        body: JSON.stringify({ ownerId: key, subscription: input })
      });
      return data.subscription ? normalizeSubscription(data.subscription) : null;
    },

    async remove(ownerId, subscriptionId) {
      const key = normalizeOwnerId(ownerId);
      const data = await request('/alert-subscriptions/' + encodeURIComponent(subscriptionId) + '?ownerId=' + encodeURIComponent(key), {
        method: 'DELETE'
      });
      return data.removed === true;
    }
  };
}

function createSupabaseAlertSubscriptionStore({ client }) {
  function rowToSubscription(row) {
    if (!row || typeof row !== 'object') return null;
    return normalizeSubscription({
      id: row.id,
      name: row.name,
      enabled: row.enabled,
      categories: Array.isArray(row.categories) ? row.categories : [],
      sourceIds: Array.isArray(row.source_ids) ? row.source_ids : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }

  function encodeFilter(value) {
    return encodeURIComponent(value);
  }

  return {
    storage: 'supabase-postgres',
    durable: true,

    async list(ownerId) {
      const key = normalizeOwnerId(ownerId);
      const query =
        '?owner_id=eq.' + encodeFilter(key) +
        '&order=updated_at.desc';
      const rows = await client.request('/radar_alert_subscriptions' + query, { method: 'GET' });
      return (Array.isArray(rows) ? rows : []).map(rowToSubscription).filter(Boolean);
    },

    async create(ownerId, input) {
      const key = normalizeOwnerId(ownerId);
      const subscription = validateSubscriptionInput(input);
      const row = {
        id: subscription.id,
        owner_id: key,
        name: subscription.name,
        enabled: subscription.enabled,
        categories: subscription.categories,
        source_ids: subscription.sourceIds,
        created_at: subscription.createdAt,
        updated_at: subscription.updatedAt
      };
      const rows = await client.request('/radar_alert_subscriptions', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(row)
      });
      return rowToSubscription(Array.isArray(rows) ? rows[0] : null) || subscription;
    },

    async update(ownerId, subscriptionId, input) {
      const key = normalizeOwnerId(ownerId);
      const current = await this.list(key);
      const existing = current.find(item => item.id === subscriptionId);
      if (!existing) return null;

      const merged = normalizeSubscription({
        ...existing,
        ...(input && typeof input === 'object' ? input : {}),
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString()
      });

      const query =
        '?id=eq.' + encodeFilter(subscriptionId) +
        '&owner_id=eq.' + encodeFilter(key);
      const rows = await client.request('/radar_alert_subscriptions' + query, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          name: merged.name,
          enabled: merged.enabled,
          categories: merged.categories,
          source_ids: merged.sourceIds,
          updated_at: merged.updatedAt
        })
      });
      return rowToSubscription(Array.isArray(rows) ? rows[0] : null) || merged;
    },

    async remove(ownerId, subscriptionId) {
      const key = normalizeOwnerId(ownerId);
      const query =
        '?id=eq.' + encodeFilter(subscriptionId) +
        '&owner_id=eq.' + encodeFilter(key);
      const rows = await client.request('/radar_alert_subscriptions' + query, {
        method: 'DELETE',
        headers: { Prefer: 'return=representation' }
      });
      return Array.isArray(rows) && rows.length > 0;
    }
  };
}

function getConfiguredAlertSubscriptionStore() {
  const supabase = require('./supabase-rest').getConfiguredSupabaseClient();
  if (supabase) return createSupabaseAlertSubscriptionStore({ client: supabase });

  const url = process.env.RADAR_ALERT_SUBSCRIPTION_STORE_URL;
  if (!url) return null;

  try {
    return createHttpAlertSubscriptionStore({
      baseUrl: url,
      token: process.env.RADAR_ALERT_SUBSCRIPTION_STORE_TOKEN || ''
    });
  } catch (_) {
    return null;
  }
}

const defaultMemoryStore = createMemoryAlertSubscriptionStore();

function getAlertSubscriptionStore() {
  return getConfiguredAlertSubscriptionStore() || defaultMemoryStore;
}

function getAlertSubscriptionStorageStatus() {
  const configured = getConfiguredAlertSubscriptionStore();
  return {
    storage: configured ? configured.storage : defaultMemoryStore.storage,
    durable: configured ? configured.durable : defaultMemoryStore.durable,
    configured: Boolean(configured),
    provider: 'Supabase Postgres or HTTPS JSON alert subscription provider'
  };
}

module.exports = {
  createMemoryAlertSubscriptionStore,
  createHttpAlertSubscriptionStore,
  createSupabaseAlertSubscriptionStore,
  getAlertSubscriptionStore,
  getAlertSubscriptionStorageStatus
};
