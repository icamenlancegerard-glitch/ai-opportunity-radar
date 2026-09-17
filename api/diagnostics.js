const {
  getHistoryStore,
  getHistoryStorageStatus
} = require('../lib/history-store');
const {
  normalizeSnapshot,
  diffSnapshots,
  makeHistoryRecord
} = require('../lib/history-engine');

// MVP 1.2 — runtime diagnostics. Read-only capability check; no persistence claimed.
module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const storage = getHistoryStorageStatus();
  const store = getHistoryStore();
  const sample = normalizeSnapshot({
    url: 'https://example.invalid/diagnostic',
    reachable: true,
    status: 200,
    checkedAt: new Date().toISOString()
  });
  const diff = diffSnapshots(null, sample);
  const record = makeHistoryRecord(sample);

  return res.status(200).json({
    ok: true,
    service: 'ai-opportunity-radar',
    version: '1.2',
    checkedAt: new Date().toISOString(),
    capabilities: {
      historyEngine: {
        normalizeSnapshot: typeof normalizeSnapshot === 'function',
        diffSnapshots: typeof diffSnapshots === 'function',
        makeHistoryRecord: typeof makeHistoryRecord === 'function'
      },
      historyStore: {
        available: !!store,
        getLatest: typeof store.getLatest === 'function',
        append: typeof store.append === 'function',
        list: typeof store.list === 'function',
        storage: storage.storage,
        durable: storage.durable
      }
    },
    selfTest: {
      normalizedUrl: sample.url,
      firstRecordChanged: record.changed,
      diffChanges: diff.changes
    },
    note: 'Diagnostics prove module wiring and in-process capability only; they do not prove durable persistence or job availability.'
  });
};
