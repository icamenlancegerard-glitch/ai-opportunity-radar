const { getHistoryStore, getHistoryStorageStatus } = require('../lib/history-store');
const { validateSourceUrl } = require('../lib/source-policy');
const { makeChangeAlerts } = require('../lib/change-alerts');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'GET only' });

  const url = typeof req.query?.url === 'string' ? req.query.url : '';
  if (!url) return res.status(400).json({ ok: false, error: 'Missing url' });

  const storage = getHistoryStorageStatus();

  try {
    const canonicalUrl = validateSourceUrl(url).toString();
    const records = await getHistoryStore().list(canonicalUrl);
    const latest = records.length ? records[records.length - 1] : null;
    const alerts = makeChangeAlerts(latest);

    return res.status(200).json({
      ok: true,
      version: '2.0',
      url: canonicalUrl,
      storage: storage.storage,
      durable: storage.durable,
      alertCount: alerts.length,
      alerts,
      note: 'Alerts are deterministic summaries of the latest recorded evidence changes. No external notification is sent by this endpoint.'
    });
  } catch (error) {
    const status = error && error.code === 'SOURCE_POLICY_REJECTED'
      ? (error.statusCode || 400)
      : 500;
    return res.status(status).json({
      ok: false,
      version: '2.0',
      error: error instanceof Error ? error.message : 'Alert read failed'
    });
  }
};
