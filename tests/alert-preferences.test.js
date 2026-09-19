const assert = require('node:assert/strict');
const {
  ALERT_GROUPS,
  ALL_ALERT_GROUPS,
  normalizeAlertPreferences,
  groupForAlertCode,
  filterAlertsByPreferences
} = require('../lib/alert-preferences');

assert.deepEqual(normalizeAlertPreferences(), ALL_ALERT_GROUPS);
assert.deepEqual(normalizeAlertPreferences(['availability', 'availability', 'invalid']), ['availability']);
assert.deepEqual(normalizeAlertPreferences([]), ALL_ALERT_GROUPS);

assert.equal(groupForAlertCode('AVAILABILITY_OPENED'), 'availability');
assert.equal(groupForAlertCode('PH_EXCLUDED'), 'eligibility');
assert.equal(groupForAlertCode('COMPENSATION_CHANGED'), 'compensation');
assert.equal(groupForAlertCode('SOURCE_DOWN'), 'source');
assert.equal(groupForAlertCode('UNKNOWN_CODE'), null);

const alerts = [
  { code: 'SOURCE_DOWN' },
  { code: 'AVAILABILITY_OPENED' },
  { code: 'PH_ELIGIBLE' },
  { code: 'COMPENSATION_CHANGED' },
  { code: 'FUTURE_EVENT' }
];

assert.equal(filterAlertsByPreferences(alerts, ['availability']).length, 2);
assert.deepEqual(
  filterAlertsByPreferences(alerts, ['availability']).map(x => x.code),
  ['AVAILABILITY_OPENED', 'FUTURE_EVENT']
);
assert.equal(filterAlertsByPreferences(alerts, ['source', 'compensation']).length, 3);

console.log('alert-preferences.test.js: PASS');
