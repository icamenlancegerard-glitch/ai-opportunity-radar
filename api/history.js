const { getHistoryStore, getHistoryStorageStatus } = require('../lib/history-store');
const { validateSourceUrl } = require('../lib/source-policy');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'GET only' });
  }

  const storage = getHistoryStorageStatus();
  const url = typeof req.query?.url === 'string' ? req.query.url : '';

  try {
    const store = getHistoryStore();
    const records = url
      ? await store.list(validateSourceUrl(url).toString())
      : await store.list();

    return res.status(200).json({
      ok: true,
      version: '1.9',
      storage: storage.storage,
      durable: storage.durable,
      configured: storage.configured,
      count: records.length,
      records,
      note: storage.durable
        ? 'History is read from the configured durable provider adapter.'
        : 'Persistent storage is not configured; history is process-local and may disappear between serverless invocations.'
    });
  } catch (error) {
    const status = error && error.code === 'SOURCE_POLICY_REJECTED'
      ? (error.statusCode || 400)
      : 500;
    return res.status(status).json({
      ok: false,
      version: '1.9',
      error: error instanceof Error ? error.message : 'History read failed'
    });
  }
};
