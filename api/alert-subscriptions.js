const {
  MAX_ALERT_SUBSCRIPTIONS,
  validateSubscriptionInput
} = require('../lib/alert-subscriptions');
const {
  getAlertSubscriptionStore,
  getAlertSubscriptionStorageStatus
} = require('../lib/alert-subscription-store');
const { normalizeOwnerId } = require('../lib/saved-search-store');
const { resolveRequestIdentity } = require('../lib/request-identity');

// MVP 3.0 — authenticated per-user alert subscription API.
// The owner is always derived from the verified identity provider.
// Client-supplied ownerId values are ignored/rejected at the API boundary.

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body); } catch (_) { return {}; }
}

function respondError(res, status, message, code = 'ALERT_SUBSCRIPTION_ERROR') {
  return res.status(status).json({
    ok: false,
    version: '3.0',
    error: message,
    code
  });
}

function getSubscriptionInput(body) {
  if (body && body.subscription && typeof body.subscription === 'object') return body.subscription;
  return body || {};
}

module.exports = async (req, res) => {
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method)) {
    return respondError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED');
  }

  let ownerId;
  try {
    const identity = await resolveRequestIdentity(req);
    ownerId = normalizeOwnerId(identity.subject);
  } catch (error) {
    return respondError(res, error.statusCode || 503, error.message, error.code);
  }

  const store = getAlertSubscriptionStore();
  const storage = getAlertSubscriptionStorageStatus();
  const body = parseBody(req);
  const requestedOwnerId = typeof body.ownerId === 'string' ? body.ownerId.trim() : '';

  if (requestedOwnerId && requestedOwnerId !== ownerId) {
    return respondError(res, 403, 'Client-supplied owner id does not match authenticated identity', 'OWNER_ID_MISMATCH');
  }

  try {
    if (req.method === 'GET') {
      const subscriptions = await store.list(ownerId);
      return res.status(200).json({
        ok: true,
        version: '3.0',
        ownerId,
        storage: storage.storage,
        durable: storage.durable,
        count: subscriptions.length,
        maxSubscriptions: MAX_ALERT_SUBSCRIPTIONS,
        subscriptions,
        note: 'Subscriptions are scoped to the authenticated identity subject.'
      });
    }

    if (req.method === 'POST') {
      const input = getSubscriptionInput(body);
      const subscription = await store.create(ownerId, validateSubscriptionInput(input));
      const subscriptions = await store.list(ownerId);
      return res.status(201).json({
        ok: true,
        version: '3.0',
        ownerId,
        storage: storage.storage,
        durable: storage.durable,
        subscription,
        subscriptions
      });
    }

    const subscriptionId =
      typeof body.id === 'string'
        ? body.id.trim()
        : typeof req.query?.id === 'string'
          ? req.query.id.trim()
          : '';

    if (!subscriptionId) {
      return respondError(res, 400, 'Subscription id is required', 'SUBSCRIPTION_ID_REQUIRED');
    }

    if (req.method === 'PATCH') {
      const updated = await store.update(ownerId, subscriptionId, getSubscriptionInput(body));
      if (!updated) return respondError(res, 404, 'Subscription not found', 'SUBSCRIPTION_NOT_FOUND');
      return res.status(200).json({
        ok: true,
        version: '3.0',
        ownerId,
        storage: storage.storage,
        durable: storage.durable,
        subscription: updated
      });
    }

    const removed = await store.remove(ownerId, subscriptionId);
    if (!removed) return respondError(res, 404, 'Subscription not found', 'SUBSCRIPTION_NOT_FOUND');
    return res.status(200).json({
      ok: true,
      version: '3.0',
      ownerId,
      storage: storage.storage,
      durable: storage.durable,
      removed: true,
      subscriptionId
    });
  } catch (error) {
    return respondError(
      res,
      error && error.statusCode ? error.statusCode : 500,
      error instanceof Error ? error.message : 'Alert subscription operation failed',
      error && error.code ? error.code : 'ALERT_SUBSCRIPTION_ERROR'
    );
  }
};
