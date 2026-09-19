const { readMonitoredAlerts } = require('./alerts-all');
const { resolveRequestIdentity } = require('../lib/request-identity');
const { getAlertSubscriptionStore, getAlertSubscriptionStorageStatus } = require('../lib/alert-subscription-store');
const { normalizeOwnerId, getSavedSearchStorageStatus } = require('../lib/saved-search-store');
const { filterAlertsForSubscriptions } = require('../lib/alert-subscriptions');

// MVP 3.0 — authenticated user alert view.
// The public /api/alerts-all inbox remains read-only and unchanged.
// This endpoint applies durable/user-owned subscription rules after identity verification.

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'GET only' });

  let ownerId;
  try {
    const identity = await resolveRequestIdentity(req);
    ownerId = normalizeOwnerId(identity.subject);
  } catch (error) {
    return res.status(error.statusCode || 503).json({
      ok: false,
      version: '3.0',
      code: error.code || 'IDENTITY_ERROR',
      error: error.message || 'Identity verification failed'
    });
  }

  const store = getAlertSubscriptionStore();
  const storage = getAlertSubscriptionStorageStatus();

  try {
    const allSubscriptions = await store.list(ownerId);
    const activeSubscriptions = allSubscriptions.filter(subscription => subscription.enabled !== false);
    const alerts = activeSubscriptions.length ? await readMonitoredAlerts() : [];
    const filtered = filterAlertsForSubscriptions(alerts, activeSubscriptions);

    return res.status(200).json({
      ok: true,
      version: '3.0',
      ownerId,
      subscriptionStorage: storage.storage,
      subscriptionDurable: storage.durable,
      subscriptionCount: allSubscriptions.length,
      activeSubscriptionCount: activeSubscriptions.length,
      monitoredAlerts: alerts.length,
      alertCount: filtered.length,
      alerts: filtered,
      note: activeSubscriptions.length
        ? 'Alerts are filtered by authenticated user-owned alert subscriptions. Unknown future event codes remain eligible for matching.'
        : 'No active alert subscription is configured for this authenticated user.'
    });
  } catch (error) {
    return res.status(error && error.statusCode ? error.statusCode : 500).json({
      ok: false,
      version: '3.0',
      code: error && error.code ? error.code : 'USER_ALERTS_ERROR',
      error: error instanceof Error ? error.message : 'User alert load failed'
    });
  }
};
