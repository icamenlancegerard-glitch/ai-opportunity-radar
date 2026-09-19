// MVP 3.1 — durable user-owned monitoring schedule contract.
// Schedules express when a user's selected monitored sources should be evaluated.
// Execution remains bounded by the platform scheduler tick; this contract does not
// claim exact wall-clock execution or exactly-once behavior.

const crypto = require('node:crypto');

const ALLOWED_CADENCE_DAYS = Object.freeze([1, 3, 7, 14, 30]);
const MAX_MONITORED_SOURCE_IDS = 50;
const MAX_SCHEDULES = 10;
const MAX_NAME_LENGTH = 60;

function normalizeSourceIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value
      .filter(id => typeof id === 'string')
      .map(id => id.trim().toLowerCase())
      .filter(id => /^[a-z0-9][a-z0-9_-]{1,63}$/.test(id))
  )].slice(0, MAX_MONITORED_SOURCE_IDS);
}

function normalizeCadenceDays(value) {
  const days = Number.parseInt(value, 10);
  return ALLOWED_CADENCE_DAYS.includes(days) ? days : 7;
}

function normalizeName(value) {
  const name = typeof value === 'string' ? value.trim().slice(0, MAX_NAME_LENGTH) : '';
  return name || 'Monitoring schedule';
}

function isValidTimestamp(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function addCadenceDays(timestamp, cadenceDays) {
  const base = new Date(timestamp);
  if (Number.isNaN(base.getTime())) return null;
  return new Date(base.getTime() + cadenceDays * 24 * 60 * 60 * 1000).toISOString();
}

function normalizeSchedule(input = {}, { now = new Date(), preserveIdentity = true } = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const id = typeof source.id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(source.id.trim())
    ? source.id.trim()
    : crypto.randomUUID();

  const createdAt = preserveIdentity && isValidTimestamp(source.createdAt)
    ? source.createdAt
    : now.toISOString();

  const updatedAt = preserveIdentity && isValidTimestamp(source.updatedAt)
    ? source.updatedAt
    : now.toISOString();

  const cadenceDays = normalizeCadenceDays(source.cadenceDays);
  const lastRunAt = isValidTimestamp(source.lastRunAt) ? source.lastRunAt : null;
  const requestedNextRunAt = isValidTimestamp(source.nextRunAt)
    ? source.nextRunAt
    : addCadenceDays(now, cadenceDays);

  return {
    id,
    name: normalizeName(source.name),
    enabled: source.enabled !== false,
    cadenceDays,
    sourceIds: normalizeSourceIds(source.sourceIds),
    nextRunAt: requestedNextRunAt,
    lastRunAt,
    leaseUntil: isValidTimestamp(source.leaseUntil) ? source.leaseUntil : null,
    createdAt,
    updatedAt
  };
}

function validateScheduleInput(input = {}) {
  const schedule = normalizeSchedule(input);
  if (!schedule.name) throw new Error('Schedule name is required');
  if (!ALLOWED_CADENCE_DAYS.includes(schedule.cadenceDays)) {
    throw new Error('Unsupported cadence');
  }
  return schedule;
}

function isDue(schedule, { now = new Date() } = {}) {
  if (!schedule || schedule.enabled === false) return false;
  if (!isValidTimestamp(schedule.nextRunAt)) return true;
  if (isValidTimestamp(schedule.leaseUntil) && Date.parse(schedule.leaseUntil) > now.getTime()) return false;
  return Date.parse(schedule.nextRunAt) <= now.getTime();
}

function calculateNextRunAt(schedule, now = new Date()) {
  const cadenceDays = normalizeCadenceDays(schedule?.cadenceDays);
  return addCadenceDays(now, cadenceDays);
}

module.exports = {
  ALLOWED_CADENCE_DAYS,
  MAX_MONITORED_SOURCE_IDS,
  MAX_SCHEDULES,
  normalizeSourceIds,
  normalizeCadenceDays,
  normalizeName,
  normalizeSchedule,
  validateScheduleInput,
  isDue,
  addCadenceDays,
  calculateNextRunAt
};
