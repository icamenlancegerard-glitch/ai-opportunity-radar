// MVP 1.6 — portable, deterministic history engine.

function normalizeAvailabilityEvidence(input) {
  const evidence = input && typeof input === 'object' ? input : {};
  const allowed = new Set(['OPEN_EVIDENCE', 'CLOSED_EVIDENCE', 'CONFLICTING_EVIDENCE', 'NOT_VERIFIED']);
  return {
    status: allowed.has(evidence.status) ? evidence.status : 'NOT_VERIFIED',
    matchedSignals: Array.isArray(evidence.matchedSignals)
      ? evidence.matchedSignals.filter(value => typeof value === 'string').slice(0, 20)
      : []
  };
}

function normalizeSnapshot(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    url: typeof source.url === 'string' ? source.url : null,
    reachable: typeof source.reachable === 'boolean' ? source.reachable : null,
    status: Number.isInteger(source.status) ? source.status : null,
    checkedAt: typeof source.checkedAt === 'string' ? source.checkedAt : null,
    availabilityEvidence: normalizeAvailabilityEvidence(source.availabilityEvidence)
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
  if (
    previous.availabilityEvidence.status !== current.availabilityEvidence.status ||
    JSON.stringify(previous.availabilityEvidence.matchedSignals) !== JSON.stringify(current.availabilityEvidence.matchedSignals)
  ) {
    changes.push('AVAILABILITY_EVIDENCE_CHANGED');
  }

  return { previous, current, changed: changes.length > 0, changes };
}

function makeHistoryRecord(snapshot, previous = null) {
  const current = normalizeSnapshot(snapshot);
  const diff = previous ? diffSnapshots(previous, current) : { changed: false, changes: [] };
  return {
    schemaVersion: '1.1',
    snapshot: current,
    previous: previous ? normalizeSnapshot(previous) : null,
    changed: diff.changed,
    changes: diff.changes
  };
}

module.exports = { normalizeSnapshot, diffSnapshots, makeHistoryRecord, normalizeAvailabilityEvidence };
