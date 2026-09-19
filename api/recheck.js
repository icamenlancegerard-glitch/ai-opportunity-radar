const { recheckAndRecord } = require('../lib/recheck-pipeline');
const { getHistoryStorageStatus } = require('../lib/history-store');

// Compatibility endpoint. All source checks use the MVP 1.8 canonical pipeline.
module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const url = typeof req.query?.url === 'string' ? req.query.url : '';
  if (!url) return res.status(400).json({ ok: false, error: 'Missing url' });

  try {
    const result = await recheckAndRecord(url);
    const storage = getHistoryStorageStatus();
    return res.status(200).json({
      ok: true,
      version: '1.8',
      ...result,
      storage: storage.storage,
      durable: storage.durable,
      note: 'Compatibility route backed by the canonical source → bounded content → availability evidence → PH eligibility evidence → compensation evidence → history → status pipeline.'
    });
  } catch (error) {
    const status = error && error.code === 'SOURCE_POLICY_REJECTED'
      ? (error.statusCode || 400)
      : 500;
    return res.status(status).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Recheck failed'
    });
  }
};
