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
      version: '1.6',
      ...result,
      storage: storage.storage,
      durable: storage.durable,
      note: 'The canonical pipeline applies source policy, captures bounded source content, derives explicit availability evidence, records history/change detection, and derives opportunity status. Availability evidence is not a guarantee of hiring, eligibility, compensation, or continued availability.'
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
