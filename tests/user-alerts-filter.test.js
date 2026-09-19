const assert = require('node:assert/strict');
const { filterAlertsForSubscriptions } = require('../lib/alert-subscriptions');

const subscriptions = [
  { id: 'sub-a', enabled: true, categories: ['availability'], sourceIds: [] },
  { id: 'sub-b', enabled: true, categories: ['compensation'], sourceIds: ['jobstreet-ai-001'] },
  { id: 'sub-off', enabled: false, categories: ['source'], sourceIds: [] }
];

const alerts = [
  { code: 'AVAILABILITY_OPENED', sourceId: 'indeed-ai-001' },
  { code: 'COMPENSATION_CHANGED', sourceId: 'jobstreet-ai-001' },
  { code: 'SOURCE_DOWN', sourceId: 'jobstreet-ai-001' }
];

const filtered = filterAlertsForSubscriptions(alerts, subscriptions);

assert.deepEqual(filtered.map(alert => alert.code), [
  'AVAILABILITY_OPENED',
  'COMPENSATION_CHANGED'
]);
assert.deepEqual(filtered[1].subscriptionIds, ['sub-b']);
console.log('user-alerts-filter.test.js: PASS');
