// MVP 3.0 — authenticated user-owned alert subscription contract.
// A subscription binds an authenticated user to alert categories and an optional
// monitored-source scope. It never changes evidence generation or alert history.

const crypto = require('node:crypto');
const {
  ALL_ALERT_GROUPS,
  normalizeAlertPreferences,
  groupForAlertCode
} = require('./alert-preferences');

const MAX_ALERT_SUBSCRIPTIONS = 10;
const MAX_SOURCE_IDS = 50;
const MAX_NAME_LENGTH = 60;
const DEFAULT_SUBSCRIPTION_NAME = 'My opportunity alerts';

function normalizeSubscriptionName(value) {
  const name = typeof value === 'string' ? value.trim().slice(0, MAX_NAME_LENGTH) : '';
  return name || DEFAULT_SUBSCRIPTION_NAME;
}

function normalizeSourceIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value
      .filter(id => typeof id === 'string')
      .map(id => id.trim().toLowerCase())
      .filter(id => /^[a-z0-9][a-z0-9_-]{1,63}$/.test(id))
  )].slice(0, MAX_SOURCE_IDS);
}

function normalizeSubscription(input = {}, { now = new Date(), preserveIdentity = true } = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const id = typeof source.id === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(source.id.trim())
    ? source.id.trim()
    : crypto.randomUUID();

  const createdAt = preserveIdentity && typeof source.createdAt === 'string' && !Number.isNaN(Date.parse(source.createdAt))
    ? source.createdAt
    : now.toISOString();

  const updatedAt = preserveIdentity && typeof source.updatedAt === 'string' && !Number.isNaN(Date.parse(source.updatedAt))
    ? source.updatedAt
    : now.toISOString();

  return {
    id,
    name: normalizeSubscriptionName(source.name),
    enabled: source.enabled !== false,
    categories: normalizeAlertPreferences(source.categories),
    sourceIds: normalizeSourceIds(source.sourceIds),
    createdAt,
    updatedAt
  };
}

function validateSubscriptionInput(input = {}) {
  const subscription = normalizeSubscription(input);
  if (!subscription.name) throw new Error('Subscription name is required');
  if (!Array.isArray(subscription.categories) || !subscription.categories.length) {
    throw new Error('At least one alert category is required');
  }
  return subscription;
}

function matchesSubscription(subscription, alert) {
  if (!subscription || subscription.enabled === false) return false;
  if (!alert || typeof alert !== 'object') return false;

  const sourceIds = normalizeSourceIds(subscription.sourceIds);
  if (sourceIds.length) {
    const sourceId = typeof alert.sourceId === 'string' ? alert.sourceId.trim().toLowerCase() : '';
    if (!sourceId || !sourceIds.includes(sourceId)) return false;
  }

  const group = groupForAlertCode(alert.code);
  if (!group) return true; // Preserve the 2.9 rule: unknown future event codes are not silently discarded.

  return normalizeAlertPreferences(subscription.categories).includes(group);
}

function filterAlertsForSubscriptions(alerts, subscriptions) {
  const normalizedSubscriptions = Array.isArray(subscriptions) ? subscriptions : [];
  const active = normalizedSubscriptions
    .map(subscription => normalizeSubscription(subscription))
    .filter(subscription => subscription.enabled);

  const results = [];
  for (const alert of Array.isArray(alerts) ? alerts : []) {
    const subscriptionIds = active
      .filter(subscription => matchesSubscription(subscription, alert))
      .map(subscription => subscription.id);

    if (subscriptionIds.length) {
      results.push({ ...alert, subscriptionIds });
    }
  }
  return results;
}

module.exports = {
  ALL_ALERT_GROUPS,
  MAX_ALERT_SUBSCRIPTIONS,
  MAX_SOURCE_IDS,
  DEFAULT_SUBSCRIPTION_NAME,
  normalizeSubscriptionName,
  normalizeSourceIds,
  normalizeSubscription,
  validateSubscriptionInput,
  matchesSubscription,
  filterAlertsForSubscriptions
};
