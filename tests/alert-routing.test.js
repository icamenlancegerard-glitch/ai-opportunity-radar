const assert = require('node:assert/strict');
const {
  routeAlertForOwner,
  routeAlertsForOwner
} = require('../lib/alert-routing');

const subscriptions = [
  {
    id: 'sub-a',
    enabled: true,
    categories: ['availability'],
    sourceIds: ['jobstreet-ai-001']
  },
  {
    id: 'sub-b',
    enabled: true,
    categories: ['compensation'],
    sourceIds: ['jobstreet-ai-001']
  },
  {
    id: 'sub-off',
    enabled: false,
    categories: ['availability'],
    sourceIds: ['jobstreet-ai-001']
  }
];

const routed = routeAlertForOwner({
  code: 'AVAILABILITY_OPENED',
  sourceId: 'jobstreet-ai-001',
  url: 'https://example.test/a',
  checkedAt: '2026-09-19T20:00:00.000Z'
}, 'alice', subscriptions);

assert.equal(routed.ownerId, 'alice');
assert.equal(routed.deliveryScope, 'user');
assert.deepEqual(routed.subscriptionIds, ['sub-a']);

const multi = routeAlertForOwner({
  code: 'COMPENSATION_CHANGED',
  sourceId: 'jobstreet-ai-001',
  url: 'https://example.test/a',
  checkedAt: '2026-09-19T20:00:00.000Z'
}, 'alice', subscriptions);

assert.deepEqual(multi.subscriptionIds, ['sub-b']);

assert.equal(routeAlertForOwner({
  code: 'AVAILABILITY_OPENED',
  sourceId: 'indeed-ai-001',
  url: 'https://example.test/b',
  checkedAt: '2026-09-19T20:00:00.000Z'
}, 'alice', subscriptions), null);

assert.equal(routeAlertForOwner({
  code: 'AVAILABILITY_OPENED',
  sourceId: 'jobstreet-ai-001',
  url: 'https://example.test/c',
  checkedAt: '2026-09-19T20:00:00.000Z'
}, '', subscriptions), null);

const unknown = routeAlertsForOwner([
  {
    code: 'FUTURE_EVENT',
    sourceId: 'jobstreet-ai-001',
    url: 'https://example.test/d',
    checkedAt: '2026-09-19T20:00:00.000Z'
  }
], 'alice', [subscriptions[0]]);

assert.equal(unknown.length, 1);
assert.deepEqual(unknown[0].subscriptionIds, ['sub-a']);

console.log('alert-routing.test.js: PASS');
