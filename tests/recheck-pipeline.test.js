const assert = require('node:assert/strict');
const { createMemoryHistoryStore } = require('../lib/history-store');
const { checkSource, recheckAndRecord } = require('../lib/recheck-pipeline');

const originalFetch = global.fetch;
let status = 200;
let body = '<button>Apply now</button><div>Must be based in the Philippines.</div><div>$8 USD/hour</div>';

global.fetch = async () => ({ status, text: async () => body });

(async () => {
  const store = createMemoryHistoryStore();

  const first = await recheckAndRecord('https://ph.indeed.com/viewjob?jk=abc#fragment', store);
  assert.equal(first.snapshot.url, 'https://ph.indeed.com/viewjob?jk=abc');
  assert.equal(first.snapshot.availabilityEvidence.status, 'OPEN_EVIDENCE');
  assert.equal(first.snapshot.eligibilityEvidence.status, 'PH_ELIGIBLE_EVIDENCE');
  assert.equal(first.snapshot.compensationEvidence.status, 'COMPENSATION_EVIDENCE');
  assert.equal(first.opportunityStatus.pay, 'COMPENSATION_EVIDENCE');
  assert.equal(first.history.changed, false);

  status = 503;
  body = '<div>This job is no longer available.</div><div>Must be based in the Philippines.</div><div>$8 USD/hour</div>';
  const second = await recheckAndRecord('https://ph.indeed.com/viewjob?jk=abc', store);
  assert.deepEqual(second.history.changes, [
    'SOURCE_DOWN',
    'HTTP_STATUS_CHANGED',
    'AVAILABILITY_EVIDENCE_CHANGED',
    'ELIGIBILITY_EVIDENCE_CHANGED',
    'COMPENSATION_EVIDENCE_CHANGED'
  ]);
  assert.equal(second.opportunityStatus.availability, 'NOT_VERIFIED');
  assert.equal(second.opportunityStatus.eligibility, 'NOT_VERIFIED');
  assert.equal(second.opportunityStatus.pay, 'NOT_VERIFIED');

  status = 200;
  body = '<div>Apply now. Must be based in the Philippines. PHP 50–100/hour.</div>';
  const third = await recheckAndRecord('https://ph.indeed.com/viewjob?jk=abc', store);
  assert.equal(third.opportunityStatus.availability, 'OPEN_EVIDENCE');
  assert.equal(third.opportunityStatus.eligibility, 'PH_ELIGIBLE_EVIDENCE');
  assert.equal(third.opportunityStatus.pay, 'COMPENSATION_EVIDENCE');
  assert.deepEqual(third.history.changes, [
    'SOURCE_RECOVERED',
    'HTTP_STATUS_CHANGED',
    'AVAILABILITY_EVIDENCE_CHANGED',
    'ELIGIBILITY_EVIDENCE_CHANGED',
    'COMPENSATION_EVIDENCE_CHANGED'
  ]);

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
