const assert = require('node:assert/strict');
const { normalizeSnapshot, diffSnapshots, makeHistoryRecord } = require('../lib/history-engine');
const { createMemoryHistoryStore } = require('../lib/history-store');

const URL = 'https://example.com/job';

const first = {
  url: URL, reachable: true, status: 200, checkedAt: '2026-09-17T00:00:00.000Z',
  availabilityEvidence: { status: 'OPEN_EVIDENCE', matchedSignals: ['OPEN:apply now'] },
  eligibilityEvidence: { status: 'PH_ELIGIBLE_EVIDENCE', matchedSignals: ['PH_ELIGIBLE:must be based in the philippines'] },
  compensationEvidence: { status: 'COMPENSATION_EVIDENCE', matchedSignals: ['PAY:$8 USD/hour'] }
};
const down = {
  url: URL, reachable: false, status: 503, checkedAt: '2026-09-17T01:00:00.000Z',
  availabilityEvidence: { status: 'NOT_VERIFIED', matchedSignals: [] },
  eligibilityEvidence: { status: 'NOT_VERIFIED', matchedSignals: [] },
  compensationEvidence: { status: 'NOT_VERIFIED', matchedSignals: [] }
};
const recovered = {
  url: URL, reachable: true, status: 200, checkedAt: '2026-09-17T02:00:00.000Z',
  availabilityEvidence: { status: 'OPEN_EVIDENCE', matchedSignals: ['OPEN:apply now'] },
  eligibilityEvidence: { status: 'PH_ELIGIBLE_EVIDENCE', matchedSignals: ['PH_ELIGIBLE:must be based in the philippines'] },
  compensationEvidence: { status: 'COMPENSATION_EVIDENCE', matchedSignals: ['PAY:PHP 50–100/hour'] }
};

assert.deepEqual(normalizeSnapshot({ url: 123, reachable: 'yes', status: '200' }), {
  url: null,
  reachable: null,
  status: null,
  checkedAt: null,
  availabilityEvidence: { status: 'NOT_VERIFIED', matchedSignals: [] },
  eligibilityEvidence: { status: 'NOT_VERIFIED', matchedSignals: [] },
  compensationEvidence: { status: 'NOT_VERIFIED', matchedSignals: [] }
});

assert.deepEqual(diffSnapshots(null, first).changes, [
  'URL_CHANGED','REACHABILITY_CHANGED','HTTP_STATUS_CHANGED',
  'AVAILABILITY_EVIDENCE_CHANGED','ELIGIBILITY_EVIDENCE_CHANGED','COMPENSATION_EVIDENCE_CHANGED'
]);
assert.deepEqual(diffSnapshots(first, down).changes, [
  'SOURCE_DOWN','HTTP_STATUS_CHANGED',
  'AVAILABILITY_EVIDENCE_CHANGED','ELIGIBILITY_EVIDENCE_CHANGED','COMPENSATION_EVIDENCE_CHANGED'
]);
assert.deepEqual(diffSnapshots(down, recovered).changes, [
  'SOURCE_RECOVERED','HTTP_STATUS_CHANGED',
  'AVAILABILITY_EVIDENCE_CHANGED','ELIGIBILITY_EVIDENCE_CHANGED','COMPENSATION_EVIDENCE_CHANGED'
]);
assert.deepEqual(diffSnapshots(first, first).changes, []);
assert.equal(makeHistoryRecord(first).changed, false);

const store = createMemoryHistoryStore();
(async () => {
  await store.append(makeHistoryRecord(first));
  assert.equal((await store.getLatest(URL)).snapshot.status, 200);
  await store.append(makeHistoryRecord(down, first));
  assert.equal((await store.getLatest(URL)).snapshot.compensationEvidence.status, 'NOT_VERIFIED');
  await store.append(makeHistoryRecord(recovered, down));
  assert.equal((await store.list(URL)).length, 3);
  console.log('PASS: history engine deterministic checks');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
