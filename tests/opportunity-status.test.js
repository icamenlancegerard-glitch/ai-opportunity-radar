const assert = require('assert');
const {
  classifySourceEvidence,
  summarizeChange,
  makeOpportunityStatus
} = require('../lib/opportunity-status');

const reachable = { url: 'https://example.com/job', reachable: true, status: 200 };
const unreachable = { url: 'https://example.com/job', reachable: false, status: 503 };

assert.equal(classifySourceEvidence(reachable), 'SOURCE_REACHABLE');
assert.equal(classifySourceEvidence(unreachable), 'SOURCE_UNREACHABLE');
assert.equal(classifySourceEvidence(reachable, unreachable), 'SOURCE_RECOVERED');
assert.equal(classifySourceEvidence({ url: 'https://example.com/job', reachable: null }), 'UNKNOWN');
assert.equal(summarizeChange({ changes: [] }), 'NO_CHANGE');
assert.equal(summarizeChange({ changes: ['HTTP_STATUS_CHANGED'] }), 'CHANGED');

const status = makeOpportunityStatus(reachable, null, { changes: [] });
assert.deepEqual(status, {
  url: 'https://example.com/job',
  sourceStatus: 'SOURCE_REACHABLE',
  changeStatus: 'NO_CHANGE',
  availability: 'NOT_VERIFIED',
  eligibility: 'NOT_VERIFIED',
  pay: 'NOT_VERIFIED',
  hiringStatus: 'NOT_VERIFIED'
});

console.log('opportunity-status.test.js: PASS');
