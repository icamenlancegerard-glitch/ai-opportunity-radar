const assert = require('assert');
const {
  createMemoryHistoryStore,
  createHistoryStore,
  getHistoryStorageStatus
} = require('../lib/history-store');

(async () => {
  const memory = createMemoryHistoryStore();
  const adapter = createHistoryStore(memory);

  assert.strictEqual(adapter.storage, 'memory-only');
  assert.strictEqual(adapter.durable, false);

  const record = {
    snapshot: {
      url: 'https://example.invalid/source',
      reachable: true,
      status: 200,
      checkedAt: '2026-09-17T00:00:00.000Z'
    },
    changed: false,
    changes: []
  };

  await adapter.append(record);
  assert.strictEqual((await adapter.list(record.snapshot.url)).length, 1);
  assert.deepStrictEqual(await adapter.getLatest(record.snapshot.url), record);

  assert.deepStrictEqual(getHistoryStorageStatus(), {
    storage: 'memory-only',
    durable: false,
    configured: false,
    providerBoundary: 'HTTP'
  });

  console.log('history-store-adapter.test.js: PASS');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
