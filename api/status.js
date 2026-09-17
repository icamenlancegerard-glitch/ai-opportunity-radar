const { getHistoryStorageStatus, getHistoryStore } = require('../lib/history-store');
const { normalizeSnapshot, diffSnapshots, makeHistoryRecord } = require('../lib/history-engine');

// MVP 1.3 — public read-only runtime status. Does not claim job availability or durable persistence.
module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const storage = getHistoryStorageStatus();
  const store = getHistoryStore();
  const engineReady = [normalizeSnapshot, diffSnapshots, makeHistoryRecord]
    .every((fn) => typeof fn === 'function');
  const storeReady = !!store && ['getLatest', 'append', 'list']
    .every((name) => typeof store[name] === 'function');

  return res.status(200).json({
    ok: engineReady && storeReady,
    service: 'ai-opportunity-radar',
    version: '1.3',
    checkedAt: new Date().toISOString(),
    runtime: {
      historyEngine: engineReady,
      historyStore: storeReady,
      storage: storage.storage,
      durable: storage.durable
    },
    verification: {
      systemHealth: engineReady && storeReady,
      jobAvailability: 'not_verified',
      eligibility: 'not_verified'
    },
    note: 'System health is separate from job availability, eligibility, pay, and hiring status.'
  });
};
