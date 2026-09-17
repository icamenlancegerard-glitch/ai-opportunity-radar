const assert = require('node:assert/strict');
const { normalizeSnapshot, diffSnapshots, makeHistoryRecord } = require('../lib/history-engine');
const { createMemoryHistoryStore } = require('../lib/history-store');

const URL = 'https://example.com/job';

const first = { url: URL, reachable: true, status: 200, checkedAt: '2026-09-17T00:00:00.000Z' };
const down = { url: URL, reachable: false, status: 503, checkedAt: '2026-09-17T01:00:00.000Z' };
const recovered = { url: URL, reachable: true, status: 200, checkedAt: '2026-09-17T02:00:00.000Z' };

assert.deepEqual(normalizeSnapshot({ url: 123, reachable: 'yes', status: '200' }), {
  url: null,
  reachable: null,
  status: null,
  checkedAt: null
});

assert.deepEqual(normalizeSnapshot(null), {
  url: null,
  reachable: null,
  status: null,
  checkedAt: null
});

assert.deepEqual(diffSnapshots(null, first).changes, ['URL_CHANGED', 'REACHABILITY_CHANGED', 'HTTP_STATUS_CHANGED']);
assert.deepEqual(diffSnapshots(first, down).changes, ['SOURCE_DOWN', 'HTTP_STATUS_CHANGED']);
assert.deepEqual(diffSnapshots(down, recovered).changes, ['SOURCE_RECOVERED', 'HTTP_STATUS_CHANGED']);
assert.deepEqual(diffSnapshots(first, first).changes, []);
assert.equal(makeHistoryRecord(first).changed, false);

const store = createMemoryHistoryStore();

(async () => {
  await store.append(makeHistoryRecord(first));
  assert.equal((await store.getLatest(URL)).snapshot.status, 200);

  await store.append(makeHistoryRecord(down, first));
  assert.deepEqual((await store.getLatest(URL)).changes, ['SOURCE_DOWN', 'HTTP_STATUS_CHANGED']);

  await store.append(makeHistoryRecord(recovered, down));
  assert.deepEqual((await store.getLatest(URL)).changes, ['SOURCE_RECOVERED', 'HTTP_STATUS_CHANGED']);
  assert.equal((await store.list(URL)).length, 3);

  console.log('PASS: history engine deterministic checks');
})();
