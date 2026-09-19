const assert = require('node:assert/strict');
const handler = require('../api/session');

function mockResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
}

(async () => {
  const notConfigured = mockResponse();
  const oldUrl = process.env.RADAR_IDENTITY_PROVIDER_URL;
  delete process.env.RADAR_IDENTITY_PROVIDER_URL;
  await handler({ method: 'GET', headers: {} }, notConfigured);
  assert.equal(notConfigured.statusCode, 503);
  assert.equal(notConfigured.body.code, 'IDENTITY_PROVIDER_NOT_CONFIGURED');

  process.env.RADAR_IDENTITY_PROVIDER_URL = 'https://identity.example.test';
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    assert.equal(String(url), 'https://identity.example.test/me');
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    return { ok: true, status: 200, json: async () => ({ subject: 'user_123' }) };
  };

  const ok = mockResponse();
  await handler({ method: 'GET', headers: { authorization: 'Bearer test-token' } }, ok);
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.body.authenticated, true);
  assert.equal(ok.body.subject, 'user_123');

  global.fetch = originalFetch;
  if (oldUrl === undefined) delete process.env.RADAR_IDENTITY_PROVIDER_URL;
  else process.env.RADAR_IDENTITY_PROVIDER_URL = oldUrl;
  console.log('session.test.js: PASS');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
