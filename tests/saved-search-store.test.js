const assert = require('node:assert/strict');
const {
  normalizeOwnerId,
  createMemorySavedSearchStore,
  createHttpSavedSearchStore
} = require('../lib/saved-search-store');

assert.equal(normalizeOwnerId(' device_123 '), 'device_123');
assert.throws(() => normalizeOwnerId('bad id'), /Invalid owner id/);
assert.throws(() => normalizeOwnerId(''), /Invalid owner id/);

(async () => {
  const store = createMemorySavedSearchStore();
  await store.replaceAll('device_1', [
    { name: 'Remote AI', query: 'AI', type: 'Evaluator', mode: 'Remote', location: 'Philippines' }
  ]);
  assert.deepEqual(await store.list('device_1'), [
    { name: 'Remote AI', query: 'AI', type: 'Evaluator', mode: 'Remote', location: 'Philippines' }
  ]);
  assert.deepEqual(await store.list('device_2'), []);

  assert.throws(
    () => createHttpSavedSearchStore({ baseUrl: 'http://example.test' }),
    /must use HTTPS/
  );

  console.log('saved-search-store.test.js: PASS');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
