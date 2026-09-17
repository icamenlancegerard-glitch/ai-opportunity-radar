const { createMemoryHistoryStore } = require('../lib/history-store');

// Process-local adapter for MVP 1.0. It is intentionally non-durable.
// Replace this adapter with Blob/database storage before claiming persistence.
const store = createMemoryHistoryStore();

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const url = typeof req.query?.url === 'string' ? req.query.url : null;
    const records = await store.list(url);
    return res.status(200).json({
      ok: true,
      version: '1.0',
      storage: 'memory-only',
      durable: false,
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
        version: '1.0',
        storage: 'memory-only',
        durable: false,
        record: saved,
        note: 'Record exists only for the lifetime of this serverless process.'
      });
    } catch (error) {
      return res.status(400).json({ ok: false, error: error instanceof Error ? error.message : 'Invalid record' });
    }
  }

  return res.status(405).json({ ok: false, error: 'Method not allowed' });
};
