const assert = require('node:assert/strict');
const { runUserMonitorScheduler } = require('../api/user-monitor-scheduler');
const { createMemoryMonitorScheduleStore } = require('../lib/monitor-schedule-store');

(async () => {
  const store = createMemoryMonitorScheduleStore();
  const now = new Date('2026-09-19T20:00:00.000Z');

  const due = await store.create('alice', {
    name: 'Due schedule',
    cadenceDays: 7,
    nextRunAt: '2026-09-18T20:00:00.000Z',
    sourceIds: ['jobstreet-ai-001']
  });

  await store.create('alice', {
    name: 'Future schedule',
    cadenceDays: 7,
    nextRunAt: '2026-09-25T20:00:00.000Z'
  });

  const calls = [];
  const queued = [];
  const subscriptionStore = {
    async list(ownerId) {
      assert.equal(ownerId, 'alice');
      return [{
        id: 'sub-availability',
        enabled: true,
        categories: ['availability'],
        sourceIds: ['jobstreet-ai-001']
      }];
    }
  };

  const report = await runUserMonitorScheduler({
    store,
    sources: [{ id:'jobstreet-ai-001', url:'https://example.test/jobstreet-ai-001' }],
    recheck: async (url) => {
      calls.push(url);
      return { history: { changed: true, snapshot:{url} } };
    },
    makeAlerts: () => [{
      code: 'AVAILABILITY_OPENED',
      severity: 'info',
      title: 'Open availability evidence detected',
      url: 'https://example.test/jobstreet-ai-001',
      checkedAt: '2026-09-19T20:00:00.000Z'
    }],
    outbox: { enqueue: async (alert) => queued.push(alert) },
    subscriptionStore,
    now
  });

  assert.equal(report.ok, true);
  assert.equal(report.dueSchedules, 1);
  assert.equal(report.processedSchedules, 1);
  assert.equal(report.matchedAlerts, 1);
  assert.equal(report.suppressedAlerts, 0);
  assert.equal(report.queuedAlerts, 1);
  assert.deepEqual(calls, ['https://example.test/jobstreet-ai-001']);
  assert.equal(queued.length, 1);
  assert.equal(queued[0].ownerId, 'alice');
  assert.deepEqual(queued[0].subscriptionIds, ['sub-availability']);
  assert.equal(queued[0].sourceId, 'jobstreet-ai-001');

  const schedules = await store.list('alice');
  const updated = schedules.find(item => item.id === due.id);
  assert.equal(updated.lastRunAt, now.toISOString());
  assert.equal(updated.nextRunAt, '2026-09-26T20:00:00.000Z');

  console.log('user-monitor-scheduler.test.js: PASS');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
