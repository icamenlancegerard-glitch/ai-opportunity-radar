const assert = require('node:assert/strict');
const handler = require('../api/saved-searches');

function mockResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
}

(async () => {
  const originalFetch = global.fetch;
  const oldUrl = process.env.RADAR_IDENTITY_PROVIDER_URL;
  process.env.RADAR_IDENTITY_PROVIDER_URL = 'https://identity.example.test';

  global.fetch = async (url, options) => {
    assert.equal(String(url), 'https://identity.example.test/me');
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    return {
      ok: true,
      status: 200,
      json: async () => ({ subject: 'user_123' })
    };
  };

  const reqPost = {
    method: 'POST',
    headers: { authorization: 'Bearer test-token', 'x-radar-user-id': 'ignored_client_id' },
    query: {},
    body: {
      search: {
        name: 'Remote evaluator',
        query: 'AI',
        type: 'Evaluator',
        mode: 'Remote',
        location: 'Philippines'
      }
    }
  };
  const resPost = mockResponse();
  await handler(reqPost, resPost);
  assert.equal(resPost.statusCode, 200);
  assert.equal(resPost.body.ownerId, 'user_123');
  assert.equal(resPost.body.searches.length, 1);

  const reqGet = {
    method: 'GET',
    headers: { authorization: 'Bearer test-token' },
    query: {}
  };
  const resGet = mockResponse();
  await handler(reqGet, resGet);
  assert.equal(resGet.statusCode, 200);
  assert.equal(resGet.body.ownerId, 'user_123');
  assert.equal(resGet.body.searches.length, 1);

  const missingAuth = mockResponse();
  await handler({ method: 'GET', headers: {}, query: {} }, missingAuth);
  assert.equal(missingAuth.statusCode, 401);
  assert.equal(missingAuth.body.code, 'IDENTITY_REQUIRED');

  global.fetch = originalFetch;
  if (oldUrl === undefined) delete process.env.RADAR_IDENTITY_PROVIDER_URL;
  else process.env.RADAR_IDENTITY_PROVIDER_URL = oldUrl;

  console.log('saved-searches-api.test.js: PASS');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
