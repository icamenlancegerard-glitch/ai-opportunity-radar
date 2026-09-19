const assert = require('node:assert/strict');
const { normalizeText, classifyAvailability } = require('../lib/availability-evidence');

assert.equal(normalizeText('<div>Apply&nbsp;Now</div>'), 'apply now');

assert.deepEqual(
  classifyAvailability('https://ph.indeed.com/viewjob?jk=1', '<button>Apply now</button>', 200),
  { status: 'OPEN_EVIDENCE', source: 'explicit_page_text', matchedSignals: ['OPEN:apply now'] }
);

assert.deepEqual(
  classifyAvailability('https://ph.indeed.com/viewjob?jk=1', '<div>This job is no longer available</div>', 200),
  { status: 'CLOSED_EVIDENCE', source: 'explicit_page_text', matchedSignals: ['CLOSED:this job is no longer available'] }
);

assert.equal(
  classifyAvailability('https://ph.indeed.com/viewjob?jk=1', '<div>Apply now. No longer accepting applications.</div>', 200).status,
  'CONFLICTING_EVIDENCE'
);

assert.equal(
  classifyAvailability('https://ph.indeed.com/viewjob?jk=1', '<div>Company overview and team culture</div>', 200).status,
  'NOT_VERIFIED'
);

assert.equal(
  classifyAvailability('https://ph.indeed.com/viewjob?jk=1', '<div>This job is no longer available</div>', 503).status,
  'NOT_VERIFIED'
);

assert.equal(
  classifyAvailability('https://example.com/job', 'Apply now', 200).status,
  'NOT_VERIFIED'
);

console.log('availability-evidence.test.js: PASS');
