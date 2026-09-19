const { getMonitorScheduleStore } = require('../lib/monitor-schedule-store');
const { getMonitoredSources } = require('../lib/monitored-sources');
const { recheckAndRecord } = require('../lib/recheck-pipeline');
const { makeChangeAlerts } = require('../lib/change-alerts');
const { getAlertOutbox } = require('../lib/alert-outbox');
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
      : [...activeSources.values()];

    try {
      let scheduleAlerts = 0;
      for (const url of selected) {
        const result = await recheck(url);
        const alerts = makeAlerts(result.history);
        for (const alert of alerts) {
          await outbox.enqueue({ ...alert, sourceUrl: url });
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
      results.push({
        scheduleId: claimed.id,
        ok: true,
        sourcesEvaluated: selected.length,
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
    version: '3.1',
    ...report,
    note: 'User monitoring schedules are durable rules evaluated by a platform scheduler tick. Exact requested execution times are not guaranteed by this endpoint.'
  });
};

module.exports.runUserMonitorScheduler = runUserMonitorScheduler;
