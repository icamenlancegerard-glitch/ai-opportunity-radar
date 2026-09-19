const assert = require('node:assert/strict');
const { classifyPhEligibility } = require('../lib/ph-eligibility-evidence');

assert.deepEqual(
  classifyPhEligibility('https://ph.indeed.com/viewjob?jk=1', '<div>Must be based in the Philippines.</div>', 200),
  {
    status: 'PH_ELIGIBLE_EVIDENCE',
    source: 'explicit_applicant_location_text',
    matchedSignals: [
      'PH_ELIGIBLE:based in the philippines',
      'PH_ELIGIBLE:must be based in the philippines'
    ]
  }
);

assert.deepEqual(
  classifyPhEligibility('https://ph.jobstreet.com/job/1', '<div>United States only.</div>', 200),
  {
    status: 'PH_EXCLUDED_EVIDENCE',
    source: 'explicit_applicant_location_text',
    matchedSignals: ['PH_EXCLUDED:united states only']
  }
);

assert.equal(
  classifyPhEligibility(
    'https://jobs.telusdigital.com/job/1',
    '<div>Must be based in the Philippines. United States only.</div>',
    200
  ).status,
  'CONFLICTING_EVIDENCE'
);

assert.equal(
  classifyPhEligibility('https://ph.indeed.com/viewjob?jk=1', '<div>Our Philippines office is growing.</div>', 200).status,
  'NOT_VERIFIED'
);

assert.equal(
  classifyPhEligibility('https://ph.indeed.com/viewjob?jk=1', '<div>Must be based in the Philippines.</div>', 503).status,
  'NOT_VERIFIED'
);

assert.equal(
  classifyPhEligibility('https://ph.indeed.com/viewjob?jk=1', '', 200).status,
  'NOT_VERIFIED'
);

console.log('ph-eligibility-evidence.test.js: PASS');
