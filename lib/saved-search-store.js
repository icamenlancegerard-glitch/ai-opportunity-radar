// MVP 2.1 — server-side saved-search persistence boundary.
// The configured provider must expose the JSON contract documented below.
// Without a valid HTTPS provider the runtime is explicitly memory-only.

const { normalizeSavedSearch, MAX_SAVED_SEARCHES } = require('./saved-searches');

const memory = new Map();

function normalizeOwnerId(value) {
  const ownerId = typeof value === 'string' ? value.trim() : '';
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(ownerId)) {
    const error = new Error('Invalid owner id');
    error.code = 'OWNER_ID_INVALID';
    error.statusCode = 400;
    throw error;
  }
  return ownerId;
}

function normalizeSearches(value) {
  if (!Array.isArray(value)) return [];
  const normalized = [];
  for (const item of value) {
    try {
      normalized.push(normalizeSavedSearch(item));
    } catch (_) {
      // Invalid rows are not allowed to poison the store response.
    }
  }
  return normalized
    .filter(item => item.name)
    .slice(0, MAX_SAVED_SEARCHES);
}

function createMemorySavedSearchStore() {
  return {
    storage: 'memory-only',
    durable: false,
    async list(ownerId) {
      const key = normalizeOwnerId(ownerId);
      return normalizeSearches(memory.get(key) || []);
    },
    async replaceAll(ownerId, searches) {
      const key = normalizeOwnerId(ownerId);
      const next = normalizeSearches(searches);
      memory.set(key, next);
      return next;
    }
  };
}

function createHttpSavedSearchStore({ baseUrl, token }) {
  const parsed = new URL(baseUrl);
  if (parsed.protocol !== 'https:') {
    const error = new Error('Saved-search persistence provider must use HTTPS');
    error.code = 'PROVIDER_INVALID';
    error.statusCode = 503;
    throw error;
  }

  async function request(path, options = {}) {
    const headers = {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };
    const response = await fetch(new URL(path, parsed), { ...options, headers });
    if (!response.ok) {
      const error = new Error(`Saved-search provider returned HTTP ${response.status}`);
      error.code = 'PROVIDER_HTTP_ERROR';
      error.statusCode = 502;
      throw error;
    }
    const text = await response.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch (_) {
      const error = new Error('Saved-search provider returned invalid JSON');
      error.code = 'PROVIDER_INVALID_JSON';
      error.statusCode = 502;
      throw error;
    }
  }

  return {
    storage: 'http-durable',
    durable: true,
    async list(ownerId) {
      const key = normalizeOwnerId(ownerId);
      const data = await request(`/saved-searches?ownerId=${encodeURIComponent(key)}`);
      return normalizeSearches(data.searches);
    },
    async replaceAll(ownerId, searches) {
      const key = normalizeOwnerId(ownerId);
      const normalized = normalizeSearches(searches);
      const data = await request('/saved-searches', {
        method: 'PUT',
        body: JSON.stringify({ ownerId: key, searches: normalized })
      });
      return normalizeSearches(data.searches || normalized);
    }
  };
}

function getConfiguredSavedSearchStore() {
  const url = process.env.RADAR_SAVED_SEARCH_STORE_URL;
  if (!url) return null;
  try {
    return createHttpSavedSearchStore({
      baseUrl: url,
      token: process.env.RADAR_SAVED_SEARCH_STORE_TOKEN || ''
    });
  } catch (_) {
    return null;
  }
}

function getSavedSearchStore() {
  return getConfiguredSavedSearchStore() || createMemorySavedSearchStore();
}

function getSavedSearchStorageStatus() {
  const configured = Boolean(getConfiguredSavedSearchStore());
  return {
    storage: configured ? 'http-durable' : 'memory-only',
    durable: configured,
    configured,
    provider: 'HTTPS JSON saved-search provider'
  };
}

module.exports = {
  MAX_SAVED_SEARCHES,
  normalizeOwnerId,
  createMemorySavedSearchStore,
  createHttpSavedSearchStore,
  getSavedSearchStore,
  getSavedSearchStorageStatus
};
