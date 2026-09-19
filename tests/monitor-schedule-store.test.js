const assert = require('node:assert/strict');
const { createMemoryMonitorScheduleStore } = require('../lib/monitor-schedule-store');

(async () => {
  const store = createMemoryMonitorScheduleStore();

  const alice = await store.create('alice', {
    name: 'Alice weekly',
    cadenceDays: 7,
    sourceIds: ['jobstreet-ai-001']
  });
  const bob = await store.create('bob', {
    name: 'Bob daily',
    cadenceDays: 1
  });

  assert.equal((await store.list('alice')).length, 1);
  assert.equal((await store.list('bob')).length, 1);

  assert.equal((await store.update('alice', bob.id, { enabled: false })), null);
  assert.equal((await store.remove('alice', bob.id)), false);

  const updated = await store.update('alice', alice.id, {
    cadenceDays: 14,
    enabled: false
  });
  assert.equal(updated.cadenceDays, 14);
  assert.equal(updated.enabled, false);

  for (let i = 0; i < 10; i++) {
    await store.create('limit-user', { name: 's' + i, cadenceDays: 7 });
  }

  await assert.rejects(
    () => store.create('limit-user', { name: 's11', cadenceDays: 7 }),
    error => error.code === 'SCHEDULE_LIMIT_REACHED' && error.statusCode === 409
  );

  console.log('monitor-schedule-store.test.js: PASS');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
