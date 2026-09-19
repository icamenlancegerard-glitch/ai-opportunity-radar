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

assert.equal(normalizeAlert(alert).eventKey, 'AVAILABILITY_OPENED|https://ph.indeed.com/viewjob?jk=1|2026-09-19T00:00:00.000Z');

(async () => {
  const store = createMemoryAlertOutbox();
  await store.enqueue(alert);
  await store.enqueue(alert);
  assert.equal((await store.list()).length, 1);
  const queued = await store.list();
  assert.equal(queued[0].status, 'queued');
  await store.markDelivered(queued[0].eventKey);
  assert.equal((await store.list())[0].status, 'delivered');

  assert.throws(
    () => createHttpAlertOutbox({ baseUrl: 'http://alerts.example.test' }),
    /must use HTTPS/
  );

  console.log('alert-outbox.test.js: PASS');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
