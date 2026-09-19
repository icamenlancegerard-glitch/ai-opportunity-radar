const assert = require('node:assert/strict');
const handler = require('../api/alert-subscriptions');

const originalFetch = global.fetch;
const originalProvider = process.env.RADAR_IDENTITY_PROVIDER_URL;
const originalSupabaseUrl = process.env.RADAR_SUPABASE_URL;
const originalSupabaseKey = process.env.RADAR_SUPABASE_SERVICE_ROLE_KEY;
const originalSubscriptionUrl = process.env.RADAR_ALERT_SUBSCRIPTION_STORE_URL;

process.env.RADAR_IDENTITY_PROVIDER_URL = 'https://identity.example';
delete process.env.RADAR_SUPABASE_URL;
delete process.env.RADAR_SUPABASE_SERVICE_ROLE_KEY;
delete process.env.RADAR_ALERT_SUBSCRIPTION_STORE_URL;

global.fetch = async (url, options = {}) => {
  const parsed = new URL(url);
  if (parsed.origin !== 'https://identity.example' || parsed.pathname !== '/me') {
    throw new Error('Unexpected fetch in API contract test: ' + url);
  }

  const auth = String(options.headers?.Authorization || '');
  const subjects = {
    'Bearer alice-token': 'alice-api-test',
    'Bearer bob-token': 'bob-api-test'
  };

  const subject = subjects[auth];
  if (!subject) {
    return {
      status: 401,
      ok: false,
      async json() { return { error: 'rejected' }; }
    };
  }

  return {
    status: 200,
    ok: true,
    async json() { return { subject }; }
  };
};

function request({ method = 'GET', token = '', body = undefined, query = {} } = {}) {
  return {
    method,
    headers: token ? { authorization: 'Bearer ' + token } : {},
    body,
    query
  };
}

function response() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    }
  };
}

(async () => {
  const missingAuth = response();
  await handler(request({ method: 'GET' }), missingAuth);
  assert.equal(missingAuth.statusCode, 401);
  assert.equal(missingAuth.payload.code, 'IDENTITY_REQUIRED');

  const mismatch = response();
  await handler(request({
    method: 'POST',
    token: 'alice-token',
    body: {
      ownerId: 'bob-api-test',
      subscription: { name: 'Alice alerts', categories: ['availability'] }
    }
  }), mismatch);
  assert.equal(mismatch.statusCode, 403);
  assert.equal(mismatch.payload.code, 'OWNER_ID_MISMATCH');

  const created = response();
  await handler(request({
    method: 'POST',
    token: 'alice-token',
    body: {
      subscription: { name: 'Alice alerts', categories: ['availability'] }
    }
  }), created);
  assert.equal(created.statusCode, 201);
  assert.equal(created.payload.ownerId, 'alice-api-test');
  assert.equal(created.payload.subscription.name, 'Alice alerts');

  const alice = response();
  await handler(request({ method: 'GET', token: 'alice-token' }), alice);
  assert.equal(alice.statusCode, 200);
  assert.equal(alice.payload.ownerId, 'alice-api-test');
  assert.equal(alice.payload.count, 1);

  const bob = response();
  await handler(request({ method: 'GET', token: 'bob-token' }), bob);
  assert.equal(bob.statusCode, 200);
  assert.equal(bob.payload.ownerId, 'bob-api-test');
  assert.equal(bob.payload.count, 0);

  const otherId = created.payload.subscription.id;

  const crossUserPatch = response();
  await handler(request({
    method: 'PATCH',
    token: 'bob-token',
    body: { id: otherId, subscription: { enabled: false } }
  }), crossUserPatch);
  assert.equal(crossUserPatch.statusCode, 404);
  assert.equal(crossUserPatch.payload.code, 'SUBSCRIPTION_NOT_FOUND');

  const crossUserDelete = response();
  await handler(request({
    method: 'DELETE',
    token: 'bob-token',
    query: { id: otherId }
  }), crossUserDelete);
  assert.equal(crossUserDelete.statusCode, 404);
  assert.equal(crossUserDelete.payload.code, 'SUBSCRIPTION_NOT_FOUND');

  console.log('alert-subscription-api.test.js: PASS');
})().finally(() => {
  global.fetch = originalFetch;
  if (originalProvider === undefined) delete process.env.RADAR_IDENTITY_PROVIDER_URL;
  else process.env.RADAR_IDENTITY_PROVIDER_URL = originalProvider;

  if (originalSupabaseUrl === undefined) delete process.env.RADAR_SUPABASE_URL;
  else process.env.RADAR_SUPABASE_URL = originalSupabaseUrl;

  if (originalSupabaseKey === undefined) delete process.env.RADAR_SUPABASE_SERVICE_ROLE_KEY;
  else process.env.RADAR_SUPABASE_SERVICE_ROLE_KEY = originalSupabaseKey;

  if (originalSubscriptionUrl === undefined) delete process.env.RADAR_ALERT_SUBSCRIPTION_STORE_URL;
  else process.env.RADAR_ALERT_SUBSCRIPTION_STORE_URL = originalSubscriptionUrl;
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
