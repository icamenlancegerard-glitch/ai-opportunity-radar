const { recheckAndRecord } = require('../lib/recheck-pipeline');
const { getHistoryStorageStatus } = require('../lib/history-store');
const { makeChangeAlerts } = require('../lib/change-alerts');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  const url = typeof req.query?.url === 'string' ? req.query.url : '';
  if (!url) return res.status(400).json({ ok: false, error: 'Missing url' });

  try {
    const result = await recheckAndRecord(url);
    const storage = getHistoryStorageStatus();
    const alerts = makeChangeAlerts(result.history);
    return res.status(200).json({
      ok: true,
      version: '2.0',
      ...result,
      alerts,
      storage: storage.storage,
      durable: storage.durable,
      note: 'The canonical pipeline derives evidence, history, and deterministic change alerts. Alerts summarize evidence changes; they do not guarantee hiring, eligibility, compensation, or continued availability.'
    });
  } catch (error) {
    const status = error && error.code === 'SOURCE_POLICY_REJECTED'
      ? (error.statusCode || 400)
      : 500;
    return res.status(status).json({ ok: false, error: error instanceof Error ? error.message : 'Recheck failed' });
  }
};
