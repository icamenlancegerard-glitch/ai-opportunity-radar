const { getMonitoredSources } = require('../lib/monitored-sources');
const { getHistoryStore, getHistoryStorageStatus } = require('../lib/history-store');
const { validateSourceUrl } = require('../lib/source-policy');
const { makeChangeAlerts } = require('../lib/change-alerts');

async function readMonitoredAlerts({
  sources = getMonitoredSources(),
  store = getHistoryStore(),
  validate = validateSourceUrl,
  makeAlerts = makeChangeAlerts
} = {}) {
  const monitored = await Promise.all(sources.map(async (source) => {
    const url = typeof source === 'string' ? source : source.url;
    try {
      const canonicalUrl = validate(url).toString();
      const records = await store.list(canonicalUrl);
      const latest = records.length ? records[records.length - 1] : null;
      return makeAlerts(latest).map(alert => ({
        ...alert,
        sourceUrl: canonicalUrl,
        sourceId: typeof source === 'object' ? source.id : null,
        sourceName: typeof source === 'object' ? source.name : null
      }));
    } catch (error) {
      return [];
    }
  }));

  return monitored.flat();
}

// MVP 2.7 — read-only monitored alert inbox backed by the source lifecycle registry.
module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'GET only' });

  const store = getHistoryStore();
  const storage = getHistoryStorageStatus();

  const alerts = await readMonitoredAlerts();
  return res.status(200).json({
    ok: true,
    version: '2.7',
    storage: storage.storage,
    durable: storage.durable,
    monitoredSources: getMonitoredSources().length,
    alertCount: alerts.length,
    alerts,
    note: 'Read-only alert inbox for deterministic recorded changes. Active sources come from the monitored-source lifecycle registry. No external notification is sent.'
  });
};

module.exports.readMonitoredAlerts = readMonitoredAlerts;
