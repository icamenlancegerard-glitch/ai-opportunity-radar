const assert = require('node:assert/strict');
const {
  ALLOWED_CADENCE_DAYS,
  normalizeSourceIds,
  normalizeCadenceDays,
  normalizeSchedule,
  isDue,
  calculateNextRunAt
} = require('../lib/monitor-schedules');

const now = new Date('2026-09-19T20:00:00.000Z');

assert.deepEqual(normalizeSourceIds([
  'JobStreet-AI-001',
  'jobstreet-ai-001',
  'bad space',
  4
]), ['jobstreet-ai-001']);

assert.equal(normalizeCadenceDays(1), 1);
assert.equal(normalizeCadenceDays(7), 7);
assert.equal(normalizeCadenceDays(999), 7);
assert.deepEqual(ALLOWED_CADENCE_DAYS, [1, 3, 7, 14, 30]);

assert.throws(
  () => require('../lib/monitor-schedules').validateScheduleInput({
    name: 'Invalid scoped schedule',
    cadenceDays: 7,
    sourceIds: ['bad space', '@@@']
  }),
  /no valid monitored source ids/
);

const schedule = normalizeSchedule({
  id: 'schedule-1',
  name: 'Every week',
  enabled: true,
  cadenceDays: 7,
  sourceIds: ['jobstreet-ai-001'],
  nextRunAt: '2026-09-18T20:00:00.000Z'
}, { now });

assert.equal(schedule.id, 'schedule-1');
assert.equal(schedule.cadenceDays, 7);
assert.equal(schedule.sourceIds[0], 'jobstreet-ai-001');
assert.equal(isDue(schedule, { now }), true);
assert.equal(
  calculateNextRunAt(schedule, now),
  '2026-09-26T20:00:00.000Z'
);

assert.equal(isDue({
  ...schedule,
  nextRunAt: '2026-09-20T20:00:00.000Z'
}, { now }), false);

assert.equal(isDue({
  ...schedule,
  enabled: false
}, { now }), false);

assert.equal(isDue({
  ...schedule,
  nextRunAt: '2026-09-18T20:00:00.000Z',
  leaseUntil: '2026-09-19T21:00:00.000Z'
}, { now }), false);

console.log('monitor-schedules.test.js: PASS');
