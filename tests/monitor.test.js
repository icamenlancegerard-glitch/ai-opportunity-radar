const assert = require('node:assert/strict');
const { isAuthorizedCron, runMonitor } = require('../api/monitor');

assert.equal(isAuthorizedCron({ headers: { authorization: 'Bearer test' } }), false);
process.env.CRON_SECRET = 'test';
assert.equal(isAuthorizedCron({ headers: { authorization: 'Bearer test' } }), true);
assert.equal(isAuthorizedCron({ headers: { authorization: 'Bearer wrong' } }), false);
delete process.env.CRON_SECRET;
assert.equal(isAuthorizedCron({ headers: { authorization: 'Bearer test' } }), false);

(async () => {
  const events = [];
  const outbox = {
    async enqueue(alert) {
      events.push(alert);
      return { ...alert, status: 'queued' };
    }
  };
  const report = await runMonitor({
    sources: ['https://example.test/a', 'https://example.test/b'],
    recheck: async url => ({
      history: {
        changed: url.endsWith('/a'),
        snapshot: {
          url,
          checkedAt: '2026-09-19T00:00:00.000Z',
          availabilityEvidence: { status: 'OPEN_EVIDENCE' }
        },
        previous: {
          availabilityEvidence: { status: 'NOT_VERIFIED' }
        },
        changes: ['AVAILABILITY_EVIDENCE_CHANGED']
      }
    }),
    makeAlerts: history => history.changed ? [{
      code: 'AVAILABILITY_OPENED',
      severity: 'info',
      title: 'Open availability evidence detected',
      url: history.snapshot.url,
      checkedAt: history.snapshot.checkedAt
    }] : [],
    outbox
  });

  assert.equal(report.ok, true);
  assert.equal(report.monitoredSources, 2);
  assert.equal(report.processedSources, 2);
  assert.equal(report.recheckFailures, 0);
  assert.equal(report.queuedAlerts, 1);
  assert.equal(events.length, 1);
  assert.equal(events[0].sourceUrl, 'https://example.test/a');

  const failed = await runMonitor({
    sources: ['https://example.test/fail'],
    recheck: async () => { throw new Error('synthetic failure'); },
    makeAlerts: () => [],
    outbox
  });
  assert.equal(failed.ok, false);
  assert.equal(failed.recheckFailures, 1);

  console.log('monitor.test.js: PASS');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
