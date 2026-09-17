// MVP 1.0b — process-local history store.
// Intentionally non-durable: serverless instances may be replaced at any time.

function createMemoryHistoryStore() {
  const records = new Map();

  return {
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

const defaultStore = createMemoryHistoryStore();

function getHistoryStore() {
  return defaultStore;
}

module.exports = { createMemoryHistoryStore, getHistoryStore };
