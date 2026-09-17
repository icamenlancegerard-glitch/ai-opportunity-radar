// MVP 1.0d — portable, deterministic history engine.
// Pure functions only: no database, no network, no fabricated persistence.

function normalizeSnapshot(input = {}) {
  return {
    url: typeof input.url === 'string' ? input.url : null,
    reachable: typeof input.reachable === 'boolean' ? input.reachable : null,
    status: Number.isInteger(input.status) ? input.status : null,
    checkedAt: typeof input.checkedAt === 'string' ? input.checkedAt : null
  };
}

function diffSnapshots(previousInput, currentInput) {
  const previous = normalizeSnapshot(previousInput);
  const current = normalizeSnapshot(currentInput);
  const changes = [];

  if (previous.url !== current.url) changes.push('URL_CHANGED');
  if (previous.reachable !== current.reachable) {
    if (current.reachable === false) changes.push('SOURCE_DOWN');
    else if (previous.reachable === false && current.reachable === true) changes.push('SOURCE_RECOVERED');
    else changes.push('REACHABILITY_CHANGED');
  }
  if (previous.status !== current.status) changes.push('HTTP_STATUS_CHANGED');

  return {
    previous,
    current,
    changed: changes.length > 0,
    changes
  };
}

function makeHistoryRecord(snapshot, previous = null) {
  const current = normalizeSnapshot(snapshot);
  const diff = previous ? diffSnapshots(previous, current) : { changed: false, changes: [] };

  return {
    schemaVersion: '1.0d',
    snapshot: current,
    previous: previous ? normalizeSnapshot(previous) : null,
    changed: diff.changed,
    changes: diff.changes
  };
}

module.exports = { normalizeSnapshot, diffSnapshots, makeHistoryRecord };
