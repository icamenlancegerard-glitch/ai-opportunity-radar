// MVP 2.0 — local saved-search contract.
// Persistence is intentionally client-side for this MVP; server-side durable
// user search storage can build on this validated schema later.

const MAX_SAVED_SEARCHES = 10;

function normalizeSavedSearch(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    name: typeof source.name === 'string' ? source.name.trim().slice(0, 60) : '',
    query: typeof source.query === 'string' ? source.query.trim().slice(0, 120) : '',
    type: typeof source.type === 'string' ? source.type.trim().slice(0, 40) : 'All types',
    mode: typeof source.mode === 'string' ? source.mode.trim().slice(0, 40) : 'All work modes',
    location: typeof source.location === 'string' ? source.location.trim().slice(0, 80) : ''
  };
}

function validateSavedSearch(input) {
  const search = normalizeSavedSearch(input);
  if (!search.name) throw new Error('Saved search name is required');
  if (search.name.length > 60) throw new Error('Saved search name is too long');
  return search;
}

function matchesSavedSearch(opportunity, search) {
  const normalized = validateSavedSearch(search);
  if (!opportunity || typeof opportunity !== 'object') return false;

  const query = normalized.query.toLowerCase();
  const location = normalized.location.toLowerCase();
  const searchable = JSON.stringify(opportunity).toLowerCase();

  if (query && !searchable.includes(query)) return false;
  if (normalized.type !== 'All types' && opportunity.type !== normalized.type) return false;
  if (normalized.mode !== 'All work modes' && opportunity.mode !== normalized.mode) return false;
  if (location && String(opportunity.location || '').toLowerCase().indexOf(location) === -1) return false;
  return true;
}

module.exports = { MAX_SAVED_SEARCHES, normalizeSavedSearch, validateSavedSearch, matchesSavedSearch };
