const assert = require('assert');
const { classifySourceEvidence, summarizeChange, makeOpportunityStatus } = require('../lib/opportunity-status');

const reachable = {
  url: 'https://example.com/job',
  reachable: true,
  status: 200,
  availabilityEvidence: { status: 'OPEN_EVIDENCE', matchedSignals: [] },
  eligibilityEvidence: { status: 'PH_ELIGIBLE_EVIDENCE', matchedSignals: [] },
  compensationEvidence: { status: 'COMPENSATION_EVIDENCE', matchedSignals: ['PAY:$8 USD/hour'] }
};
const unreachable = {
  url: 'https://example.com/job',
  reachable: false,
  status: 503,
  availabilityEvidence: { status: 'NOT_VERIFIED', matchedSignals: [] },
  eligibilityEvidence: { status: 'NOT_VERIFIED', matchedSignals: [] },
  compensationEvidence: { status: 'NOT_VERIFIED', matchedSignals: [] }
};

assert.equal(classifySourceEvidence(reachable), 'SOURCE_REACHABLE');
assert.equal(classifySourceEvidence(unreachable), 'SOURCE_UNREACHABLE');
assert.equal(classifySourceEvidence(reachable, unreachable), 'SOURCE_RECOVERED');
assert.equal(summarizeChange({ changes: [] }), 'NO_CHANGE');
assert.equal(summarizeChange({ changes: ['HTTP_STATUS_CHANGED'] }), 'CHANGED');

assert.deepEqual(makeOpportunityStatus(reachable, null, { changes: [] }), {
  url: 'https://example.com/job',
  sourceStatus: 'SOURCE_REACHABLE',
  changeStatus: 'NO_CHANGE',
  availability: 'OPEN_EVIDENCE',
  eligibility: 'PH_ELIGIBLE_EVIDENCE',
  pay: 'COMPENSATION_EVIDENCE',
  hiringStatus: 'NOT_VERIFIED'
});

assert.equal(
  makeOpportunityStatus(
    { url: 'https://example.com/job', reachable: true, compensationEvidence: { status: 'NOT_VERIFIED' } },
    null, { changes: [] }
  ).pay,
  'NOT_VERIFIED'
);
console.log('opportunity-status.test.js: PASS');
