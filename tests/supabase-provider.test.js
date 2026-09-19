const assert = require('node:assert/strict');
const {
  createSupabaseRestClient,
  getSupabaseConfig
} = require('../lib/supabase-rest');
const { createSupabaseHistoryStore } = require('../lib/history-store');
const { createSupabaseAlertOutbox } = require('../lib/alert-outbox');

assert.equal(getSupabaseConfig({ RADAR_SUPABASE_URL: '', RADAR_SUPABASE_SERVICE_ROLE_KEY: 'x' }), null);
assert.equal(getSupabaseConfig({ RADAR_SUPABASE_URL: 'http://db.example.test', RADAR_SUPABASE_SERVICE_ROLE_KEY: 'x' }), null);

(async () => {
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });

    if (String(url).includes('/radar_history?')) {
      return { ok: true, status: 200, json: async () => [{ record: { snapshot: { url: 'https://ph.indeed.com/viewjob?jk=test' } } }] };
    }

    if (String(url).endsWith('/radar_history')) {
      return { ok: true, status: 201, json: async () => [{ record: { snapshot: { url: 'https://ph.indeed.com/viewjob?jk=test' } } }] };
    }

    if (String(url).endsWith('/radar_alert_events') && options.method === 'POST') {
      const body = JSON.parse(options.body);
      return { ok: true, status: 201, json: async () => [{
        event_key: body.event_key,
        payload: body.payload,
        status: body.status,
        attempts: body.attempts,
        created_at: body.created_at,
        next_attempt_at: body.next_attempt_at,
        lease_until: body.lease_until,
        last_error: body.last_error,
        delivered_at: body.delivered_at
      }] };
    }

    if (String(url).includes('/radar_alert_events?')) {
      return { ok: true, status: 200, json: async () => [] };
    }

    if (String(url).includes('/rpc/radar_claim_alert_event')) {
      return { ok: true, status: 200, json: async () => [] };
    }

    if (String(url).includes('/rpc/radar_mark_alert_delivered')) {
      return { ok: true, status: 200, json: async () => [] };
    }

    if (String(url).includes('/rpc/radar_mark_alert_failed')) {
      return { ok: true, status: 200, json: async () => [] };
    }

    throw new Error('Unexpected URL: ' + String(url));
  };

  const client = createSupabaseRestClient({
    baseUrl: 'https://demo.supabase.co/',
    serviceRoleKey: 'service-role-test'
  });

  const history = createSupabaseHistoryStore({ client });
  const record = {
    schemaVersion: '1.3',
    snapshot: {
      url: 'https://ph.indeed.com/viewjob?jk=test',
      reachable: true,
      status: 200,
      checkedAt: '2026-09-19T00:00:00.000Z'
    },
    previous: null,
    changed: false,
    changes: []
  };

  assert.equal((await history.getLatest(record.snapshot.url)).snapshot.url, record.snapshot.url);
  assert.equal((await history.list(record.snapshot.url)).length, 1);
  assert.equal((await history.append(record)).snapshot.url, record.snapshot.url);

  const outbox = createSupabaseAlertOutbox({ client });
  const queued = await outbox.enqueue({
    code: 'SOURCE_DOWN',
    severity: 'warning',
    title: 'Source became unreachable',
    url: record.snapshot.url,
    checkedAt: record.snapshot.checkedAt
  });

  assert.equal(queued.status, 'queued');
  assert.match(calls[0].options.headers.Authorization, /^Bearer /);
  assert.equal(calls.some(call => call.url.includes('/radar_history')), true);
  assert.equal(calls.some(call => call.url.includes('/radar_alert_events')), true);

  global.fetch = originalFetch;
  console.log('supabase-provider.test.js: PASS');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
