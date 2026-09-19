const SOURCES = [
  'https://ph.indeed.com/viewjob?jk=03a8507824d49250',
  'https://ph.indeed.com/viewjob?jk=a7d4a2a28797af71',
  'https://ph.jobstreet.com/job/94200540',
  'https://ph.jobstreet.com/job/94235501',
  'https://jobs.telusdigital.com/search/cfm5/customer-experience-cx/jobs/in/country/philippines?ns_category=artificial-intelligence'
];

const { getHistoryStore, getHistoryStorageStatus } = require('../lib/history-store');
const { validateSourceUrl } = require('../lib/source-policy');
const { makeChangeAlerts } = require('../lib/change-alerts');

// MVP 2.2 — read-only monitored alert inbox.
module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'GET only' });

  const store = getHistoryStore();
  const storage = getHistoryStorageStatus();

  const monitored = await Promise.all(SOURCES.map(async (url) => {
    try {
      const canonicalUrl = validateSourceUrl(url).toString();
      const records = await store.list(canonicalUrl);
      const latest = records.length ? records[records.length - 1] : null;
      return makeChangeAlerts(latest).map(alert => ({ ...alert, sourceUrl: canonicalUrl }));
    } catch (error) {
      return [];
    }
  }));

  const alerts = monitored.flat();
  return res.status(200).json({
    ok: true,
    version: '2.2',
    storage: storage.storage,
    durable: storage.durable,
    monitoredSources: SOURCES.length,
    alertCount: alerts.length,
    alerts,
    note: 'Read-only alert inbox for deterministic recorded changes. No external notification is sent.'
  });
};
