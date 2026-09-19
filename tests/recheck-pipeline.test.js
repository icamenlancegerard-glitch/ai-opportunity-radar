const assert = require('node:assert/strict');
const { createMemoryHistoryStore } = require('../lib/history-store');
const { checkSource, recheckAndRecord } = require('../lib/recheck-pipeline');

const originalFetch = global.fetch;
let status = 200;

global.fetch = async () => ({ status });

(async () => {
  const store = createMemoryHistoryStore();

  const first = await recheckAndRecord('https://ph.indeed.com/viewjob?jk=abc#fragment', store);
  assert.equal(first.snapshot.url, 'https://ph.indeed.com/viewjob?jk=abc');
  assert.equal(first.snapshot.reachable, true);
  assert.equal(first.opportunityStatus.sourceStatus, 'SOURCE_REACHABLE');
  assert.equal(first.history.changed, false);

  status = 503;
  const second = await recheckAndRecord('https://ph.indeed.com/viewjob?jk=abc', store);
  assert.equal(second.snapshot.reachable, false);
  assert.deepEqual(second.history.changes, ['SOURCE_DOWN', 'HTTP_STATUS_CHANGED']);
  assert.equal(second.opportunityStatus.sourceStatus, 'SOURCE_UNREACHABLE');
  assert.equal(second.opportunityStatus.availability, 'NOT_VERIFIED');

  status = 200;
  const third = await recheckAndRecord('https://ph.indeed.com/viewjob?jk=abc', store);
  assert.equal(third.opportunityStatus.sourceStatus, 'SOURCE_RECOVERED');
  assert.deepEqual(third.history.changes, ['SOURCE_RECOVERED', 'HTTP_STATUS_CHANGED']);

  await assert.rejects(
    () => checkSource('https://example.com/job'),
    (error) => error && error.code === 'SOURCE_POLICY_REJECTED' && error.statusCode === 403
  );

  global.fetch = originalFetch;
  console.log('recheck-pipeline.test.js: PASS');
})().catch((error) => {
  global.fetch = originalFetch;
  console.error(error);
  process.exitCode = 1;
});
