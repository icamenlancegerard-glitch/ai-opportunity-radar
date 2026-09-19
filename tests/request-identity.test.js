const assert = require('node:assert/strict');
const {
  validateSubject,
  getIdentityStatus,
  resolveRequestIdentity
} = require('../lib/request-identity');

assert.equal(validateSubject('user_123'), 'user_123');
assert.throws(() => validateSubject('bad subject'), /invalid subject/);
assert.equal(getIdentityStatus().configured, false);

(async () => {
  await assert.rejects(
    () => resolveRequestIdentity({ headers: {} }),
    error => error.code === 'IDENTITY_REQUIRED' && error.statusCode === 401
  );

  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    assert.equal(String(url), 'https://identity.example.test/me');
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    return {
      ok: true,
      status: 200,
      json: async () => ({ subject: 'user_123' })
    };
  };

  const oldUrl = process.env.RADAR_IDENTITY_PROVIDER_URL;
  process.env.RADAR_IDENTITY_PROVIDER_URL = 'https://identity.example.test';
  const identity = await resolveRequestIdentity({
    headers: { authorization: 'Bearer test-token' }
  });
  assert.deepEqual(identity, {
    subject: 'user_123',
    provider: 'HTTPS identity provider',
    authenticated: true
  });

  global.fetch = originalFetch;
  if (oldUrl === undefined) delete process.env.RADAR_IDENTITY_PROVIDER_URL;
  else process.env.RADAR_IDENTITY_PROVIDER_URL = oldUrl;
  console.log('request-identity.test.js: PASS');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
