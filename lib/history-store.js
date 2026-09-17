// MVP 1.1 — history storage adapter contract.
// Memory remains the default. No durable provider is claimed or configured.

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

function createHistoryStore(adapter) {
  return validateAdapter(adapter);
}

const defaultStore = createMemoryHistoryStore();

function getHistoryStore() {
  return defaultStore;
}

function getHistoryStorageStatus() {
  return {
    storage: defaultStore.storage || 'custom',
    durable: defaultStore.durable === true
  };
}

module.exports = {
  createMemoryHistoryStore,
  createHistoryStore,
  getHistoryStore,
  getHistoryStorageStatus
};
