const { getMonitoredSources } = require('../lib/monitored-sources');
const { recheckAndRecord } = require('../lib/recheck-pipeline');
const { getHistoryStorageStatus } = require('../lib/history-store');
const { makeChangeAlerts } = require('../lib/change-alerts');
const { getAlertOutbox, getAlertOutboxStatus } = require('../lib/alert-outbox');
const { isAuthorizedCron } = require('../lib/cron-auth');

// MVP 2.6 — scheduled monitoring loop uses active source lifecycle registry.
// Vercel Cron requests are authenticated with CRON_SECRET.
// The loop rechecks sources, records history, and queues deterministic alerts.
// It does not claim external delivery unless a separate delivery system is configured.

async function runMonitor({
  sources = getMonitoredSources().map(source => source.url),
  recheck = recheckAndRecord,
  makeAlerts = makeChangeAlerts,
  outbox = getAlertOutbox()
} = {}) {
  const results = [];
  let recheckFailures = 0;
  let queuedAlerts = 0;

  for (const url of sources) {
    try {
      const result = await recheck(url);
      const alerts = makeAlerts(result.history);
      const queued = [];
      for (const alert of alerts) {
        queued.push(await outbox.enqueue({ ...alert, sourceUrl: url }));
      }
      queuedAlerts += queued.length;
      results.push({ url, ok: true, alerts: queued });
    } catch (error) {
      recheckFailures += 1;
      results.push({
        url,
        ok: false,
        alerts: [],
        error: error instanceof Error ? error.message : 'monitor recheck failed'
      });
    }
  }

  return {
    ok: recheckFailures === 0,
    monitoredSources: sources.length,
    processedSources: results.length,
    recheckFailures,
    queuedAlerts,
    results
  };
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

function buildMonitorResponse({ report, history, alertStore }) {
  return {
    ok: report.ok,
    version: '2.6',
    monitoredSources: report.monitoredSources,
    processedSources: report.processedSources,
    recheckFailures: report.recheckFailures,
    queuedAlerts: report.queuedAlerts,
    historyStorage: history.storage,
    historyDurable: history.durable,
    alertOutboxStorage: alertStore.storage,
    alertOutboxDurable: alertStore.durable,
    results: report.results,
    note: 'Scheduled monitoring records bounded evidence changes and queues deterministic alerts. External notification delivery is not performed by this monitor.'
  };
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'GET only' });
  if (!isAuthorizedCron(req)) {
    return res.status(401).json({
      ok: false,
      version: '2.5',
      error: 'Unauthorized cron request',
      code: 'CRON_UNAUTHORIZED'
    });
  }

  const report = await runMonitor();
  const history = getHistoryStorageStatus();
  const alertStore = getAlertOutboxStatus();

  return res.status(200).json(buildMonitorResponse({ report, history, alertStore }));
};

module.exports.isAuthorizedCron = isAuthorizedCron;
module.exports.runMonitor = runMonitor;
module.exports.buildMonitorResponse = buildMonitorResponse;
