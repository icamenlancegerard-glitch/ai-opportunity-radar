const assert = require('node:assert/strict');
const handler = require('../api/monitor-schedules');

const originalFetch = global.fetch;
const originalIdentity = process.env.RADAR_IDENTITY_PROVIDER_URL;
const originalSupabaseUrl = process.env.RADAR_SUPABASE_URL;
const originalSupabaseKey = process.env.RADAR_SUPABASE_SERVICE_ROLE_KEY;

process.env.RADAR_IDENTITY_PROVIDER_URL = 'https://identity.example';
delete process.env.RADAR_SUPABASE_URL;
delete process.env.RADAR_SUPABASE_SERVICE_ROLE_KEY;

global.fetch = async (url, options = {}) => {
  const parsed = new URL(url);
  if (parsed.origin !== 'https://identity.example' || parsed.pathname !== '/me') {
    throw new Error('Unexpected fetch in schedule API test: ' + url);
  }

  const auth = String(options.headers?.Authorization || '');
  const subjects = {
    'Bearer alice-token': 'alice-schedule-test',
    'Bearer bob-token': 'bob-schedule-test'
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

function request({ method='GET', token='', body, query={} }={}) {
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
    status(code){ this.statusCode = code; return this; },
    json(body){ this.payload = body; return this; }
  };
}

(async () => {
  const missing = response();
  await handler(request(), missing);
  assert.equal(missing.statusCode, 401);

  const create = response();
  await handler(request({
    method:'POST',
    token:'alice-token',
    body:{ schedule:{ name:'Alice weekly', cadenceDays:7 } }
  }), create);
  assert.equal(create.statusCode, 201);
  assert.equal(create.payload.ownerId, 'alice-schedule-test');

  const alice = response();
  await handler(request({token:'alice-token'}), alice);
  assert.equal(alice.statusCode, 200);
  assert.equal(alice.payload.count, 1);

  const bob = response();
  await handler(request({token:'bob-token'}), bob);
  assert.equal(bob.statusCode, 200);
  assert.equal(bob.payload.count, 0);

  const crossUpdate = response();
  await handler(request({
    method:'PATCH',
    token:'bob-token',
    body:{ id:create.payload.schedule.id, schedule:{ enabled:false } }
  }), crossUpdate);
  assert.equal(crossUpdate.statusCode, 404);
  assert.equal(crossUpdate.payload.code, 'SCHEDULE_NOT_FOUND');

  console.log('monitor-schedule-api.test.js: PASS');
})().finally(() => {
  global.fetch = originalFetch;
  if (originalIdentity === undefined) delete process.env.RADAR_IDENTITY_PROVIDER_URL;
  else process.env.RADAR_IDENTITY_PROVIDER_URL = originalIdentity;
  if (originalSupabaseUrl === undefined) delete process.env.RADAR_SUPABASE_URL;
  else process.env.RADAR_SUPABASE_URL = originalSupabaseUrl;
  if (originalSupabaseKey === undefined) delete process.env.RADAR_SUPABASE_SERVICE_ROLE_KEY;
  else process.env.RADAR_SUPABASE_SERVICE_ROLE_KEY = originalSupabaseKey;
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
