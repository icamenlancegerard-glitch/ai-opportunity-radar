const { recheckAndRecord } = require('../lib/recheck-pipeline');
const { getHistoryStorageStatus } = require('../lib/history-store');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const url = typeof req.query?.url === 'string' ? req.query.url : '';
  if (!url) return res.status(400).json({ ok: false, error: 'Missing url' });

  try {
    const result = await recheckAndRecord(url);
    const storage = getHistoryStorageStatus();
    return res.status(200).json({
      ok: true,
      version: '1.5',
      ...result,
      storage: storage.storage,
      durable: storage.durable,
      note: 'The canonical pipeline applies source policy, records a snapshot, computes history/change detection, and derives opportunity status. It does not confirm job availability, eligibility, compensation, or hiring status.'
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
