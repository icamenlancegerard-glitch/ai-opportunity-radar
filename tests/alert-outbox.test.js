const assert = require('node:assert/strict');
const {
  normalizeAlert,
  createMemoryAlertOutbox,
  createHttpAlertOutbox
} = require('../lib/alert-outbox');

const alert = {
  code: 'AVAILABILITY_OPENED',
  severity: 'info',
  title: 'Open availability evidence detected',
  url: 'https://ph.indeed.com/viewjob?jk=1',
  checkedAt: '2026-09-19T00:00:00.000Z'
};

const fixedNow = new Date('2026-09-19T00:05:00.000Z');

assert.equal(
  normalizeAlert(alert).eventKey,
  'AVAILABILITY_OPENED|https://ph.indeed.com/viewjob?jk=1|2026-09-19T00:00:00.000Z'
);

(async () => {
  const store = createMemoryAlertOutbox();
  const queued = await store.enqueue(alert);
  await store.enqueue(alert);
  assert.equal((await store.list()).length, 1);
  assert.equal(queued.status, 'queued');
  assert.equal(queued.attempts, 0);

  const claimed = await store.claim(queued.eventKey, {
    now: fixedNow,
    leaseUntil: '2026-09-19T00:10:00.000Z'
  });
  assert.equal(claimed.status, 'delivering');
  assert.equal(claimed.attempts, 1);
  assert.equal((await store.list({ statuses: ['delivering'], now: fixedNow })).length, 0);

  const done = await store.markDelivered(queued.eventKey, { now: fixedNow });
  assert.equal(done.status, 'delivered');
  assert.equal(done.deliveredAt, '2026-09-19T00:05:00.000Z');
  assert.equal((await store.list({ statuses: ['queued', 'retry', 'delivering'] })).length, 0);

  const retryAlert = await store.enqueue({
    ...alert,
    code: 'SOURCE_DOWN'
  });
  const retryClaim = await store.claim(retryAlert.eventKey, {
    now: fixedNow,
    leaseUntil: '2026-09-19T00:10:00.000Z'
  });
  const retry = await store.markFailed(retryAlert.eventKey, {
    error: 'temporary provider outage',
    nextAttemptAt: '2026-09-19T00:06:00.000Z',
    maxAttempts: 3
  });
  assert.equal(retryClaim.attempts, 1);
  assert.equal(retry.status, 'retry');
  assert.equal((await store.list({ statuses: ['retry'], now: fixedNow })).length, 0);
  assert.equal(
    (await store.list({ statuses: ['retry'], now: new Date('2026-09-19T00:06:00.000Z') })).length,
    1
  );

  assert.throws(
    () => createHttpAlertOutbox({ baseUrl: 'http://alerts.example.test' }),
    /must use HTTPS/
  );

  console.log('alert-outbox.test.js: PASS');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
