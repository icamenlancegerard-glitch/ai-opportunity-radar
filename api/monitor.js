const { MONITORED_SOURCES } = require('../lib/monitored-sources');
const { recheckAndRecord } = require('../lib/recheck-pipeline');
const { getHistoryStorageStatus } = require('../lib/history-store');
const { makeChangeAlerts } = require('../lib/change-alerts');
const { getAlertOutbox, getAlertOutboxStatus } = require('../lib/alert-outbox');

// MVP 2.4 — scheduled monitoring loop.
// Vercel Cron requests are authenticated with CRON_SECRET.
// The loop rechecks sources, records history, and queues deterministic alerts.
// It does not claim external delivery unless a separate delivery system is configured.

function isAuthorizedCron(req) {
  const configured = typeof process.env.CRON_SECRET === 'string' && process.env.CRON_SECRET.length > 0;
  const presented = req.headers?.authorization || req.headers?.Authorization || '';
  return configured && presented === `Bearer ${process.env.CRON_SECRET}`;
}

function failureSnapshot(url) {
  return {
    snapshot: {
      url,
      reachable: false,
      status: null,
      checkedAt: new Date().toISOString(),
      availabilityEvidence: { status: 'NOT_VERIFIED', source: 'monitor_recheck_failed', matchedSignals: [] },
      eligibilityEvidence: { status: 'NOT_VERIFIED', source: 'monitor_recheck_failed', matchedSignals: [] },
      compensationEvidence: { status: 'NOT_VERIFIED', source: 'monitor_recheck_failed', matchedSignals: [] }
    },
    history: null,
    alerts: [],
    error: null
  };
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'GET only' });
  if (!isAuthorizedCron(req)) {
    return res.status(401).json({
      ok: false,
      version: '2.4',
      error: 'Unauthorized cron request',
      code: 'CRON_UNAUTHORIZED'
    });
  }

  const outbox = getAlertOutbox();
  const results = [];
  let recheckFailures = 0;
  let queuedAlerts = 0;

  for (const url of MONITORED_SOURCES) {
    try {
      const result = await recheckAndRecord(url);
      const alerts = makeChangeAlerts(result.history);
      const queued = [];
      for (const alert of alerts) {
        queued.push(await outbox.enqueue({ ...alert, sourceUrl: url }));
      }
      queuedAlerts += queued.length;
      results.push({ url, ok: true, alerts: queued });
    } catch (error) {
      recheckFailures += 1;
      results.push({
        ...failureSnapshot(url),
        error: error instanceof Error ? error.message : 'monitor recheck failed'
      });
    }
  }

  const history = getHistoryStorageStatus();
  const alertStore = getAlertOutboxStatus();

  return res.status(200).json({
    ok: recheckFailures === 0,
    version: '2.4',
    monitoredSources: MONITORED_SOURCES.length,
    processedSources: results.length,
    recheckFailures,
    queuedAlerts,
    historyStorage: history.storage,
    historyDurable: history.durable,
    alertOutboxStorage: alertStore.storage,
    alertOutboxDurable: alertStore.durable,
    results,
    note: 'Scheduled monitoring records bounded evidence changes and queues deterministic alerts. External notification delivery is not performed by this monitor.'
  });
};

module.exports.isAuthorizedCron = isAuthorizedCron;
