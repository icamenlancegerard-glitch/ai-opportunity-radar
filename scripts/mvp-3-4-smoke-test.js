const assert = require('node:assert/strict');
const { MAX_URLS, normalizeInputUrls, runBatch } = require('../api/recheck-batch');

assert.equal(MAX_URLS, 10);
assert.deepEqual(
  normalizeInputUrls([
    ' https://ph.indeed.com/viewjob?jk=1 ',
    'https://ph.indeed.com/viewjob?jk=1',
    ...Array.from({ length: 10 }, (_, i) => 'https://ph.jobstreet.com/job/' + i),
  ]).length,
  10
);

(async () => {
  const seen = [];
  const fakeStore = {};
  const fakeRecheck = async (url) => {
    seen.push(url);
    return {
      snapshot: {
        url,
        checkedAt: '2026-09-23T00:00:00.000Z',
        reachable: true,
        status: 200,
      },
      history: { changed: false, changes: [] },
      opportunityStatus: {
        sourceStatus: 'SOURCE_REACHABLE',
        availability: 'NOT_VERIFIED',
        eligibility: 'NOT_VERIFIED',
        pay: 'NOT_VERIFIED',
        hiringStatus: 'NOT_VERIFIED',
      },
    };
  };

  const report = await runBatch([
    'https://ph.indeed.com/viewjob?b=2&a=1',
    'https://ph.indeed.com/viewjob?a=1&b=2',
    'https://example.com/not-allowlisted',
  ], { store: fakeStore, recheck: fakeRecheck });

  assert.equal(report.accepted, 1);
  assert.equal(report.blocked, 1);
  assert.equal(seen.length, 1);
  assert.equal(report.results[0].httpStatus, 200);
  assert.equal(report.blockedResults[0].code, 'SOURCE_POLICY_REJECTED');

  console.log('MVP 3.4 smoke test passed.');
})();
