const assert = require('node:assert/strict');
const { createMemoryAlertOutbox } = require('../lib/alert-outbox');
const { runAlertDeliveryCycle, backoffMs } = require('../api/alert-worker');

const now = new Date('2026-09-19T01:00:00.000Z');

(async () => {
  assert.equal(backoffMs(1, 60000), 60000);
  assert.equal(backoffMs(2, 60000), 120000);
  assert.equal(backoffMs(3, 60000), 240000);

  const successOutbox = createMemoryAlertOutbox();
  const alert = {
    code: 'AVAILABILITY_OPENED',
    severity: 'info',
    title: 'Open availability evidence detected',
    url: 'https://example.test/a',
    checkedAt: '2026-09-19T00:00:00.000Z'
  };
  const queued = await successOutbox.enqueue(alert);
  const sent = [];
  const success = await runAlertDeliveryCycle({
    outbox: successOutbox,
    delivery: { async send(event) { sent.push(event); return { accepted: true }; } },
    now,
    maxEvents: 10
  });
  assert.equal(success.ok, true);
  assert.equal(success.claimed, 1);
  assert.equal(success.delivered, 1);
  assert.equal(success.retried, 0);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].eventKey, queued.eventKey);
  assert.equal((await successOutbox.list())[0].status, 'delivered');

  const retryOutbox = createMemoryAlertOutbox();
  await retryOutbox.enqueue({ ...alert, code: 'SOURCE_DOWN' });
  const failing = { async send() { throw new Error('provider timeout'); } };

  const first = await runAlertDeliveryCycle({
    outbox: retryOutbox,
    delivery: failing,
    now,
    maxAttempts: 3,
    backoffBaseMs: 60000
  });
  assert.equal(first.retried, 1);
  assert.equal(first.failed, 0);
  assert.equal((await retryOutbox.list())[0].status, 'retry');

  const secondNow = new Date('2026-09-19T01:01:00.000Z');
  const second = await runAlertDeliveryCycle({
    outbox: retryOutbox,
    delivery: failing,
    now: secondNow,
    maxAttempts: 3,
    backoffBaseMs: 60000
  });
  assert.equal(second.retried, 1);
  assert.equal((await retryOutbox.list())[0].attempts, 2);

  const thirdNow = new Date('2026-09-19T01:03:00.000Z');
  const third = await runAlertDeliveryCycle({
    outbox: retryOutbox,
    delivery: failing,
    now: thirdNow,
    maxAttempts: 3,
    backoffBaseMs: 60000
  });
  assert.equal(third.failed, 1);
  assert.equal((await retryOutbox.list())[0].status, 'failed');
  assert.equal((await retryOutbox.list())[0].nextAttemptAt, null);

  const routedOutbox = createMemoryAlertOutbox();
  const routedAlice = await routedOutbox.enqueue({
    ...alert,
    ownerId: 'alice',
    subscriptionIds: ['sub-availability'],
    code: 'AVAILABILITY_OPENED'
  });
  const routedBob = await routedOutbox.enqueue({
    ...alert,
    ownerId: 'bob',
    subscriptionIds: ['sub-availability'],
    code: 'AVAILABILITY_OPENED'
  });
  assert.notEqual(routedAlice.eventKey, routedBob.eventKey);
  assert.equal((await routedOutbox.list()).length, 2);
  const routedSend = [];
  const routed = await runAlertDeliveryCycle({
    outbox: routedOutbox,
    delivery: {
      supportsUserRouting: false,
      async send(event) { routedSend.push(event); return { accepted: true }; }
    },
    now
  });
  assert.equal(routed.failed, 1);
  assert.equal(routedSend.length, 0);
  assert.equal(routed.results[0].code, 'USER_ROUTING_UNSUPPORTED');
  assert.equal((await routedOutbox.list())[0].status, 'failed');

  const unconfigured = await runAlertDeliveryCycle({
    outbox: createMemoryAlertOutbox(),
    delivery: null,
    now
  });
  assert.equal(unconfigured.ok, false);
  assert.equal(unconfigured.code, 'DELIVERY_NOT_CONFIGURED');

  console.log('alert-worker.test.js: PASS');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
