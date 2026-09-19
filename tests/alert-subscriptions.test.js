const assert = require('node:assert/strict');
const {
  normalizeSourceIds,
  normalizeSubscription,
  validateSubscriptionInput,
  matchesSubscription,
  filterAlertsForSubscriptions
} = require('../lib/alert-subscriptions');
const { createMemoryAlertSubscriptionStore } = require('../lib/alert-subscription-store');

assert.deepEqual(normalizeSourceIds(['JobStreet-AI-001', 'jobstreet-ai-001', 'bad space', 4]), ['jobstreet-ai-001']);

const normalized = normalizeSubscription({
  name: '  My alerts  ',
  enabled: true,
  categories: ['availability', 'availability', 'invalid'],
  sourceIds: ['jobstreet-ai-001']
});
assert.equal(normalized.name, 'My alerts');
assert.deepEqual(normalized.categories, ['availability']);
assert.deepEqual(normalized.sourceIds, ['jobstreet-ai-001']);
assert.ok(normalized.id);
assert.ok(normalized.createdAt);
assert.ok(normalized.updatedAt);

const valid = validateSubscriptionInput({ categories: ['compensation'] });
assert.deepEqual(valid.categories, ['compensation']);

const availability = {
  id: 'sub-availability',
  enabled: true,
  categories: ['availability'],
  sourceIds: ['jobstreet-ai-001']
};

assert.equal(matchesSubscription(availability, {
  code: 'AVAILABILITY_OPENED',
  sourceId: 'jobstreet-ai-001'
}), true);
assert.equal(matchesSubscription(availability, {
  code: 'SOURCE_DOWN',
  sourceId: 'jobstreet-ai-001'
}), false);
assert.equal(matchesSubscription(availability, {
  code: 'AVAILABILITY_OPENED',
  sourceId: 'indeed-ai-001'
}), false);
assert.equal(matchesSubscription(availability, {
  code: 'FUTURE_EVENT',
  sourceId: 'jobstreet-ai-001'
}), true);
assert.equal(matchesSubscription({ ...availability, enabled: false }, {
  code: 'AVAILABILITY_OPENED',
  sourceId: 'jobstreet-ai-001'
}), false);

const filtered = filterAlertsForSubscriptions([
  { code: 'AVAILABILITY_OPENED', sourceId: 'jobstreet-ai-001' },
  { code: 'COMPENSATION_CHANGED', sourceId: 'jobstreet-ai-001' },
  { code: 'FUTURE_EVENT', sourceId: 'jobstreet-ai-001' }
], [availability]);
assert.deepEqual(filtered.map(item => item.code), ['AVAILABILITY_OPENED', 'FUTURE_EVENT']);
assert.deepEqual(filtered[0].subscriptionIds, ['sub-availability']);

(async () => {
  const store = createMemoryAlertSubscriptionStore();

  const lance = await store.create('lance', { name: 'Lance alerts', categories: ['availability'] });
  const other = await store.create('other', { name: 'Other alerts', categories: ['source'] });

  assert.equal((await store.list('lance')).length, 1);
  assert.equal((await store.list('other')).length, 1);
  assert.equal((await store.update('lance', other.id, { enabled: false })), null);

  const updated = await store.update('lance', lance.id, {
    name: 'Updated',
    categories: ['compensation'],
    enabled: false
  });
  assert.equal(updated.name, 'Updated');
  assert.equal(updated.enabled, false);
  assert.deepEqual(updated.categories, ['compensation']);
  assert.equal((await store.remove('other', lance.id)), false);
  assert.equal((await store.remove('lance', lance.id)), true);
  assert.equal((await store.list('lance')).length, 0);

  for (let i = 0; i < 10; i++) {
    await store.create('limit-user', { name: 's' + i, categories: ['source'] });
  }
  await assert.rejects(
    () => store.create('limit-user', { name: 's11', categories: ['source'] }),
    error => error.code === 'SUBSCRIPTION_LIMIT_REACHED' && error.statusCode === 409
  );

  console.log('alert-subscriptions.test.js: PASS');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
