const {
  MAX_SAVED_SEARCHES,
  normalizeOwnerId,
  getSavedSearchStore,
  getSavedSearchStorageStatus
} = require('../lib/saved-search-store');
const { resolveRequestIdentity } = require('../lib/request-identity');
const { validateSavedSearch } = require('../lib/saved-searches');

// MVP 2.1 — server-side saved-search API.
// Identity is client-supplied in this MVP; authentication/authorization is not implied.

function getBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try {
    return JSON.parse(req.body);
  } catch (_) {
    return {};
  }
}

function respondError(res, status, message, code = 'SAVED_SEARCH_ERROR') {
  return res.status(status).json({
    ok: false,
    version: '2.1',
    error: message,
    code
  });
}

module.exports = async (req, res) => {
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
    return respondError(res, 405, 'Method not allowed');
  }

  let ownerId;
  try {
    const identity = await resolveRequestIdentity(req);
    ownerId = normalizeOwnerId(identity.subject);
  } catch (error) {
    return respondError(res, error.statusCode || 503, error.message, error.code);
  }

  const storage = getSavedSearchStorageStatus();
  const store = getSavedSearchStore();

  try {
    if (req.method === 'GET') {
      const searches = await store.list(ownerId);
      return res.status(200).json({
        ok: true,
        version: '2.1',
        ownerId,
        storage: storage.storage,
        durable: storage.durable,
        count: searches.length,
        searches,
        note: 'Owner identity is derived from the authenticated identity provider; client-supplied owner IDs are ignored.'
      });
    }

    const current = await store.list(ownerId);

    if (req.method === 'POST') {
      const search = validateSavedSearch(getBody(req).search || getBody(req));
      const next = current.filter(item => item.name.toLowerCase() !== search.name.toLowerCase());
      next.unshift(search);
      const saved = await store.replaceAll(ownerId, next.slice(0, MAX_SAVED_SEARCHES));
      return res.status(200).json({
        ok: true,
        version: '2.1',
        ownerId,
        storage: storage.storage,
        durable: storage.durable,
        search,
        searches: saved
      });
    }

    const name = typeof getBody(req).name === 'string'
      ? getBody(req).name.trim().slice(0, 60)
      : '';
    if (!name) return respondError(res, 400, 'Saved search name is required');
    const next = current.filter(item => item.name.toLowerCase() !== name.toLowerCase());
    const saved = await store.replaceAll(ownerId, next);
    return res.status(200).json({
      ok: true,
      version: '2.1',
      ownerId,
      storage: storage.storage,
      durable: storage.durable,
      removed: current.length !== saved.length,
      searches: saved
    });
  } catch (error) {
    const status = error && error.statusCode ? error.statusCode : 500;
    return respondError(res, status, error instanceof Error ? error.message : 'Saved-search operation failed', error.code);
  }
};
