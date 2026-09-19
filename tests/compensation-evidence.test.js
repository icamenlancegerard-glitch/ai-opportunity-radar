const assert = require('node:assert/strict');
const { classifyCompensation } = require('../lib/compensation-evidence');

assert.equal(
  classifyCompensation('https://ph.indeed.com/viewjob?jk=1', '<div>$8 USD/hour</div>', 200).status,
  'COMPENSATION_EVIDENCE'
);
assert.deepEqual(
  classifyCompensation('https://ph.jobstreet.com/job/1', '<div>PHP 50–100/hour</div>', 200).matchedSignals,
  ['PAY:PHP 50–100/hour']
);
assert.equal(
  classifyCompensation('https://ph.jobstreet.com/job/1', '<div>₱34,000/month</div>', 200).status,
  'COMPENSATION_EVIDENCE'
);
assert.equal(
  classifyCompensation('https://ph.indeed.com/viewjob?jk=1', '<div>Competitive salary and great benefits.</div>', 200).status,
  'NOT_VERIFIED'
);
assert.equal(
  classifyCompensation('https://ph.indeed.com/viewjob?jk=1', '<div>Contact us at $500 for more information.</div>', 200).status,
  'NOT_VERIFIED'
);
assert.equal(
  classifyCompensation('https://ph.indeed.com/viewjob?jk=1', '<div>$8 USD/hour</div>', 503).status,
  'NOT_VERIFIED'
);
assert.equal(
  classifyCompensation('https://example.com/job', '<div>$8 USD/hour</div>', 200).status,
  'COMPENSATION_EVIDENCE'
);

console.log('compensation-evidence.test.js: PASS');
