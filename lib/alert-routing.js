// MVP 3.2 — authenticated user-scoped alert delivery routing intent.
// Recorded evidence and deterministic alert generation remain global.
// This module only decides whether a generated alert matches an authenticated
// user's active subscriptions and, when it does, attaches routing metadata.
// It does not claim that an external delivery provider has actually delivered it.

const {
  normalizeSubscription,
  matchesSubscription
} = require('./alert-subscriptions');

function normalizeOwnerId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function activeSubscriptions(subscriptions) {
  return (Array.isArray(subscriptions) ? subscriptions : [])
    .map(subscription => normalizeSubscription(subscription))
    .filter(subscription => subscription.enabled);
}

function routeAlertForOwner(alert, ownerId, subscriptions) {
  if (!alert || typeof alert !== 'object') return null;

  const normalizedOwnerId = normalizeOwnerId(ownerId);
  if (!normalizedOwnerId) return null;

  const matchingIds = activeSubscriptions(subscriptions)
    .filter(subscription => matchesSubscription(subscription, alert))
    .map(subscription => subscription.id);

  if (!matchingIds.length) return null;

  return {
    ...alert,
    ownerId: normalizedOwnerId,
    subscriptionIds: [...new Set(matchingIds)],
    deliveryScope: 'user'
  };
}

function routeAlertsForOwner(alerts, ownerId, subscriptions) {
  return (Array.isArray(alerts) ? alerts : [])
    .map(alert => routeAlertForOwner(alert, ownerId, subscriptions))
    .filter(Boolean);
}

module.exports = {
  activeSubscriptions,
  routeAlertForOwner,
  routeAlertsForOwner
};
