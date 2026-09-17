// MVP 1.0 — persistence boundary for opportunity history.
// No storage provider is assumed. This module defines a deterministic in-memory
// contract so a durable adapter can be added without changing the recheck logic.

function createMemoryHistoryStore() {
  const records = new Map();

  return {
    async getLatest(url) {
      return records.get(url) || null;
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

module.exports = { createMemoryHistoryStore };
