// MVP 1.6 — deterministic opportunity status from source evidence only.

function classifySourceEvidence(snapshot, previous = null) {
  if (!snapshot || typeof snapshot.url !== 'string') return 'UNKNOWN';
  if (snapshot.reachable === false) return 'SOURCE_UNREACHABLE';
  if (snapshot.reachable === true) {
    if (previous && previous.reachable === false) return 'SOURCE_RECOVERED';
    return 'SOURCE_REACHABLE';
  }
  return 'UNKNOWN';
}

function summarizeChange(history) {
  if (!history || !Array.isArray(history.changes)) return 'UNKNOWN';
  if (history.changes.length === 0) return 'NO_CHANGE';
  return 'CHANGED';
}

function makeOpportunityStatus(snapshot, previous, history) {
  const availability = snapshot?.availabilityEvidence?.status;
  const allowed = new Set(['OPEN_EVIDENCE', 'CLOSED_EVIDENCE', 'CONFLICTING_EVIDENCE']);
  return {
    url: snapshot && typeof snapshot.url === 'string' ? snapshot.url : null,
    sourceStatus: classifySourceEvidence(snapshot, previous),
    changeStatus: summarizeChange(history),
    availability: allowed.has(availability) ? availability : 'NOT_VERIFIED',
    eligibility: 'NOT_VERIFIED',
    pay: 'NOT_VERIFIED',
    hiringStatus: 'NOT_VERIFIED'
  };
}

module.exports = { classifySourceEvidence, summarizeChange, makeOpportunityStatus };
