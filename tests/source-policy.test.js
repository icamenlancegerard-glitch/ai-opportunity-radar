const assert = require('node:assert/strict');
const {
  validateSourceUrl,
  canonicalizeSourceUrl,
  getSourcePolicyStatus
} = require('../lib/source-policy');

assert.equal(canonicalizeSourceUrl('https://ph.indeed.com/viewjob?jk=abc#details'), 'https://ph.indeed.com/viewjob?jk=abc');
assert.equal(canonicalizeSourceUrl('https://PH.INDEED.COM:443/viewjob?z=2&jk=abc&a=1#details'), 'https://ph.indeed.com/viewjob?a=1&jk=abc&z=2');
assert.equal(validateSourceUrl('https://ph.jobstreet.com/job/123').hostname, 'ph.jobstreet.com');

assert.throws(() => validateSourceUrl('http://ph.indeed.com/viewjob?jk=abc'), /Only HTTPS/);
assert.throws(() => validateSourceUrl('https://example.com/job'), /not allowlisted/);
assert.throws(() => validateSourceUrl('https://user:pass@ph.indeed.com/viewjob?jk=abc'), /Credentials/);
assert.throws(() => validateSourceUrl('not a url'), /Invalid url/);

const status = getSourcePolicyStatus();
assert.equal(status.httpsOnly, true);
assert.equal(status.credentialsBlocked, true);
assert.equal(status.allowlistSize, 5);
assert.deepEqual(status.allowedHosts, [
  'careers-mci2.icims.com',
  'jobs.telusdigital.com',
  'ph.indeed.com',
  'ph.jobstreet.com',
  'ph.linkedin.com'
]);

console.log('source-policy.test.js: PASS');
