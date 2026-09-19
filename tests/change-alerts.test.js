const assert = require('node:assert/strict');
const { makeChangeAlerts } = require('../lib/change-alerts');

const base = {
  url: 'https://ph.indeed.com/viewjob?jk=1',
  checkedAt: '2026-09-19T00:00:00.000Z'
};

const first = {
  changed: true,
  snapshot: {
    ...base,
    availabilityEvidence: { status: 'OPEN_EVIDENCE' },
    eligibilityEvidence: { status: 'PH_ELIGIBLE_EVIDENCE' },
    compensationEvidence: { status: 'COMPENSATION_EVIDENCE' }
  },
  previous: {
    availabilityEvidence: { status: 'NOT_VERIFIED' },
    eligibilityEvidence: { status: 'NOT_VERIFIED' },
    compensationEvidence: { status: 'NOT_VERIFIED' }
  },
  changes: [
    'AVAILABILITY_EVIDENCE_CHANGED',
    'ELIGIBILITY_EVIDENCE_CHANGED',
    'COMPENSATION_EVIDENCE_CHANGED'
  ]
};

const events = makeChangeAlerts(first);
assert.deepEqual(events.map(x => x.code), [
  'AVAILABILITY_OPENED',
  'PH_ELIGIBLE',
  'COMPENSATION_STATED'
]);

const closed = makeChangeAlerts({
  changed: true,
  snapshot: {
    ...base,
    availabilityEvidence: { status: 'CLOSED_EVIDENCE' },
    eligibilityEvidence: { status: 'PH_EXCLUDED_EVIDENCE' },
    compensationEvidence: { status: 'COMPENSATION_EVIDENCE' }
  },
  previous: {
    availabilityEvidence: { status: 'OPEN_EVIDENCE' },
    eligibilityEvidence: { status: 'PH_ELIGIBLE_EVIDENCE' },
    compensationEvidence: { status: 'COMPENSATION_EVIDENCE', matchedSignals: ['PAY:$8 USD/hour'] }
  },
  changes: [
    'SOURCE_DOWN',
    'HTTP_STATUS_CHANGED',
    'AVAILABILITY_EVIDENCE_CHANGED',
    'ELIGIBILITY_EVIDENCE_CHANGED',
    'COMPENSATION_EVIDENCE_CHANGED'
  ]
});
assert.deepEqual(closed.map(x => x.code), [
  'SOURCE_DOWN',
  'AVAILABILITY_CLOSED',
  'PH_EXCLUDED',
  'COMPENSATION_CHANGED'
]);

const samePayChanged = makeChangeAlerts({
  changed: true,
  snapshot: {
    ...base,
    compensationEvidence: { status: 'COMPENSATION_EVIDENCE', matchedSignals: ['PAY:$10 USD/hour'] }
  },
  previous: {
    compensationEvidence: { status: 'COMPENSATION_EVIDENCE', matchedSignals: ['PAY:$8 USD/hour'] }
  },
  changes: ['COMPENSATION_EVIDENCE_CHANGED']
});
assert.equal(samePayChanged[0].code, 'COMPENSATION_CHANGED');

assert.deepEqual(makeChangeAlerts({ changed: false, changes: [] }), []);
console.log('change-alerts.test.js: PASS');
