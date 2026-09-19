const { getMonitorScheduleStore } = require('../lib/monitor-schedule-store');
const { getMonitoredSources } = require('../lib/monitored-sources');
const { recheckAndRecord } = require('../lib/recheck-pipeline');
const { makeChangeAlerts } = require('../lib/change-alerts');
const { getAlertOutbox } = require('../lib/alert-outbox');
const { getAlertSubscriptionStore } = require('../lib/alert-subscription-store');
const { routeAlertsForOwner } = require('../lib/alert-routing');
const { isAuthorizedCron } = require('../lib/cron-auth');
const { calculateNextRunAt, isDue } = require('../lib/monitor-schedules');

// MVP 3.1 — protected scheduler for authenticated user-owned monitoring rules.
// The scheduler tick itself is platform-driven. A schedule records desired cadence;
// it does not guarantee exact wall-clock execution.

async function runUserMonitorScheduler({
  store = getMonitorScheduleStore(),
  sources = getMonitoredSources(),
  recheck = recheckAndRecord,
  makeAlerts = makeChangeAlerts,
  outbox = getAlertOutbox(),
  subscriptionStore = getAlertSubscriptionStore(),
  now = new Date(),
  maxSchedules = 25
} = {}) {
  const due = typeof store.listDue === 'function'
    ? await store.listDue(now)
    : [];

  const activeSources = new Map(
    sources.map(source => [typeof source === 'string' ? source : source.id, typeof source === 'string' ? source : source.url])
  );

  let processed = 0;
  let skipped = 0;
  let queuedAlerts = 0;
  let matchedAlerts = 0;
  let suppressedAlerts = 0;
  let failures = 0;
  const results = [];

  for (const schedule of due.slice(0, maxSchedules)) {
    if (!isDue(schedule, { now })) {
      skipped += 1;
      continue;
    }

    const leaseUntil = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
    const claimed = typeof store.claim === 'function'
      ? await store.claim(schedule.id, { leaseUntil, now })
      : schedule;

    if (!claimed) {
      skipped += 1;
      continue;
    }

    const selected = Array.isArray(claimed.sourceIds) && claimed.sourceIds.length
      ? claimed.sourceIds
          .map(id => activeSources.get(id))
          .filter(Boolean)
      : [...normalizedSources];

    try {
      const ownerId = typeof claimed.ownerId === 'string' ? claimed.ownerId.trim() : '';
      if (!ownerId) {
        const error = new Error('Schedule owner identity is unavailable');
        error.code = 'SCHEDULE_OWNER_UNAVAILABLE';
        throw error;
      }

      const subscriptions = typeof subscriptionStore?.list === 'function'
        ? await subscriptionStore.list(ownerId)
        : [];

      let scheduleAlerts = 0;
      let scheduleMatched = 0;
      let scheduleSuppressed = 0;

      for (const source of selected) {
        const result = await recheck(source.url);
        const alerts = makeAlerts(result.history).map(alert => ({
          ...alert,
          sourceId: source.id || null,
          sourceUrl: source.url
        }));

        const routed = routeAlertsForOwner(alerts, ownerId, subscriptions);
        scheduleMatched += routed.length;
        scheduleSuppressed += Math.max(0, alerts.length - routed.length);

        for (const alert of routed) {
          await outbox.enqueue(alert);
          scheduleAlerts += 1;
        }
      }

      const nextRunAt = calculateNextRunAt(claimed, now);
      if (typeof store.markComplete === 'function') {
        await store.markComplete(claimed.id, {
          nextRunAt,
          lastRunAt: now.toISOString(),
          now
        });
      }

      processed += 1;
      queuedAlerts += scheduleAlerts;
      matchedAlerts += scheduleMatched;
      suppressedAlerts += scheduleSuppressed;
      results.push({
        scheduleId: claimed.id,
        ok: true,
        ownerId,
        activeSubscriptions: subscriptions.filter(subscription => subscription.enabled !== false).length,
        sourcesEvaluated: selected.length,
        matchedAlerts: scheduleMatched,
        suppressedAlerts: scheduleSuppressed,
        queuedAlerts: scheduleAlerts,
        nextRunAt
      });
    } catch (error) {
      failures += 1;
      if (typeof store.release === 'function') await store.release(claimed.id, { now });
      results.push({
        scheduleId: claimed.id,
        ok: false,
        sourcesEvaluated: selected.length,
        queuedAlerts: 0,
        error: error instanceof Error ? error.message : 'scheduled monitor failed'
      });
    }
  }

  return {
    ok: failures === 0,
    dueSchedules: due.length,
    processedSchedules: processed,
    skippedSchedules: skipped,
    failedSchedules: failures,
    queuedAlerts,
    matchedAlerts,
    suppressedAlerts,
    results
  };
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'GET only' });
  if (!isAuthorizedCron(req)) {
    return res.status(401).json({
      ok: false,
      version: '3.1',
      error: 'Unauthorized scheduler request',
      code: 'CRON_UNAUTHORIZED'
    });
  }

  const report = await runUserMonitorScheduler();
  return res.status(200).json({
    ok: report.ok,
    version: '3.2',
    ...report,
    note: 'User schedules still use a platform scheduler tick. Generated evidence alerts are routed into the authenticated owner\'s active subscriptions before entering the delivery outbox; exact wall-clock execution and external delivery remain separate verification boundaries.'
  });
};

module.exports.runUserMonitorScheduler = runUserMonitorScheduler;
