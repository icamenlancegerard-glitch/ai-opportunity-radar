const {
  getHistoryStore,
  getHistoryStorageStatus
} = require('../lib/history-store');

// MVP 1.2 — shared history adapter. Durable storage remains a separate step.
const store = getHistoryStore();

module.exports = async (req, res) => {
  const status = getHistoryStorageStatus();

  if (req.method === 'GET') {
    const url = typeof req.query?.url === 'string' ? req.query.url : null;
    const records = await store.list(url);
    return res.status(200).json({
      ok: true,
      version: '1.2',
      storage: status.storage,
      durable: status.durable,
      count: records.length,
      records,
      note: 'Process-local history is not durable across serverless invocations.'
    });
  }

  if (req.method === 'POST') {
    try {
      const record = req.body;
      const saved = await store.append(record);
      return res.status(201).json({
        ok: true,
        version: '1.2',
        storage: status.storage,
        durable: status.durable,
        record: saved
      });
    } catch (error) {
      return res.status(400).json({
        ok: false,
        error: error instanceof Error ? error.message : 'Invalid record'
      });
    }
  }

  return res.status(405).json({ ok: false, error: 'Method not allowed' });
};
