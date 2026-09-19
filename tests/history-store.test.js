const assert = require('node:assert/strict');
const {
  createMemoryHistoryStore,
  createHttpHistoryStore,
  getHistoryStorageStatus
} = require('../lib/history-store');

(async () => {
  const memory = createMemoryHistoryStore();
  const record = {
    schemaVersion: '1.3',
    snapshot: {
      url: 'https://ph.indeed.com/viewjob?jk=abc',
      reachable: true,
      status: 200,
      checkedAt: '2026-09-19T00:00:00.000Z'
    },
    previous: null,
    changed: false,
    changes: []
  };

  await memory.append(record);
  assert.equal(memory.durable, false);
  assert.equal((await memory.getLatest(record.snapshot.url)).snapshot.status, 200);
  assert.equal((await memory.list(record.snapshot.url)).length, 1);

  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.includes('/latest?')) return { ok: true, status: 200, json: async () => ({ record }) };
    if (url.endsWith('/records') && options.method === 'POST') {
      return { ok: true, status: 200, json: async () => ({ record }) };
    }
    return { ok: true, status: 200, json: async () => ({ records: [record] }) };
  };

  const durable = createHttpHistoryStore({
    baseUrl: 'https://history.example.test/',
    token: 'test-token'
  });

  assert.equal(durable.storage, 'http-durable');
  assert.equal(durable.durable, true);
  assert.equal((await durable.getLatest(record.snapshot.url)).snapshot.status, 200);
  assert.equal((await durable.list(record.snapshot.url)).length, 1);
  assert.equal((await durable.append(record)).snapshot.url, record.snapshot.url);
  assert.equal(calls[0].url, 'https://history.example.test/latest?url=' + encodeURIComponent(record.snapshot.url));
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-token');
  assert.equal(calls[1].url, 'https://history.example.test/records?url=' + encodeURIComponent(record.snapshot.url));
  assert.equal(calls[2].url, 'https://history.example.test/records');
  assert.equal(calls[2].options.method, 'POST');

  assert.throws(
    () => createHttpHistoryStore({ baseUrl: 'http://history.example.test' }),
    /HISTORY_STORE_URL must be an HTTPS URL/
  );

  const previousUrl = process.env.HISTORY_STORE_URL;
  process.env.HISTORY_STORE_URL = 'http://invalid.example.test';
  assert.equal(getHistoryStorageStatus().durable, false);
  assert.equal(getHistoryStorageStatus().configured, false);
  if (previousUrl === undefined) delete process.env.HISTORY_STORE_URL;
  else process.env.HISTORY_STORE_URL = previousUrl;

  global.fetch = originalFetch;
  console.log('history-store.test.js: PASS');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
