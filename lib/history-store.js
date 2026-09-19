// MVP 2.8 — history storage adapters with optional Supabase REST durability.
// Memory remains the safe fallback.
// A configured HTTP adapter provides a real durable-provider boundary without
// pretending that Vercel/serverless process memory is persistent.

function validateAdapter(adapter) {
  if (!adapter || typeof adapter.getLatest !== 'function' ||
      typeof adapter.append !== 'function' || typeof adapter.list !== 'function') {
    throw new Error('Invalid history store adapter');
  }
  return adapter;
}

function createMemoryHistoryStore() {
  const records = new Map();

  return {
    storage: 'memory-only',
    durable: false,

    async getLatest(url) {
      const history = records.get(url) || [];
      return history.length ? history[history.length - 1] : null;
    },

    async append(record) {
      if (!record || !record.snapshot || typeof record.snapshot.url !== 'string') {
        throw new Error('Invalid history record');
      }
      const url = record.snapshot.url;
      const history = records.get(url) || [];
      history.push(record);
      records.set(url, history);
      return record;
    },

    async list(url) {
      if (typeof url === 'string') return records.get(url) || [];
      return Array.from(records.values()).flat();
    }
  };
}

function createHttpHistoryStore({ baseUrl, token = '' } = {}) {
  if (typeof baseUrl !== 'string' || !/^https:\/\//i.test(baseUrl)) {
    throw new Error('HISTORY_STORE_URL must be an HTTPS URL');
  }

  const root = baseUrl.replace(/\/+$/, '');
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json'
  };
  if (token) headers.Authorization = 'Bearer ' + token;

  async function request(path, options = {}) {
    const response = await fetch(root + path, {
      ...options,
      headers: { ...headers, ...(options.headers || {}) }
    });

    let body = null;
    try { body = await response.json(); } catch {}

    if (!response.ok) {
      const detail = body && typeof body.error === 'string' ? body.error : 'history store request failed';
      throw new Error(detail + ' (HTTP ' + response.status + ')');
    }
    return body || {};
  }

  return {
    storage: 'http-durable',
    durable: true,

    async getLatest(url) {
      const data = await request('/latest?url=' + encodeURIComponent(url));
      return data.record || null;
    },

    async append(record) {
      if (!record || !record.snapshot || typeof record.snapshot.url !== 'string') {
        throw new Error('Invalid history record');
      }
      const data = await request('/records', {
        method: 'POST',
        body: JSON.stringify({ record })
      });
      return data.record || record;
    },

    async list(url) {
      const suffix = typeof url === 'string'
        ? '?url=' + encodeURIComponent(url)
        : '';
      const data = await request('/records' + suffix);
      return Array.isArray(data.records) ? data.records : [];
    }
  };
}

function createSupabaseHistoryStore({ client }) {
  return {
    storage: 'supabase-postgres',
    durable: true,

    async getLatest(url) {
      const query = '?source_url=eq.' + encodeURIComponent(url) + '&order=checked_at.desc&limit=1';
      const rows = await client.request('/radar_history' + query, { method: 'GET' });
      return Array.isArray(rows) && rows.length ? rows[0].record : null;
    },

    async append(record) {
      if (!record || !record.snapshot || typeof record.snapshot.url !== 'string') {
        throw new Error('Invalid history record');
      }
      const payload = {
        source_url: record.snapshot.url,
        checked_at: record.snapshot.checkedAt,
        record
      };
      const rows = await client.request('/radar_history', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(payload)
      });
      return Array.isArray(rows) && rows.length ? rows[0].record : record;
    },

    async list(url) {
      const query = typeof url === 'string'
        ? '?source_url=eq.' + encodeURIComponent(url) + '&order=checked_at.asc'
        : '?order=checked_at.asc';
      const rows = await client.request('/radar_history' + query, { method: 'GET' });
      return Array.isArray(rows) ? rows.map(row => row.record).filter(Boolean) : [];
    }
  };
}

function getConfiguredHistoryStore() {
  const supabase = require('./supabase-rest').getConfiguredSupabaseClient();
  if (supabase) return createSupabaseHistoryStore({ client: supabase });

  const url = process.env.HISTORY_STORE_URL;
  if (!url) return null;

  try {
    return createHttpHistoryStore({
      baseUrl: url,
      token: process.env.HISTORY_STORE_TOKEN || ''
    });
  } catch {
    return null;
  }
}

const defaultMemoryStore = createMemoryHistoryStore();

function getHistoryStore() {
  return getConfiguredHistoryStore() || defaultMemoryStore;
}

function getHistoryStorageStatus() {
  const configured = getConfiguredHistoryStore();
  if (configured) {
    return {
      storage: configured.storage,
      durable: configured.durable,
      configured: true,
      providerBoundary: 'HTTP'
    };
  }

  return {
    storage: defaultMemoryStore.storage,
    durable: defaultMemoryStore.durable,
    configured: false,
    providerBoundary: 'HTTP'
  };
}

module.exports = {
  createMemoryHistoryStore,
  createHttpHistoryStore,
  createHistoryStore: validateAdapter,
  createSupabaseHistoryStore,
  getHistoryStore,
  getHistoryStorageStatus
};
