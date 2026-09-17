// MVP 1.4 — deterministic opportunity status from source evidence only.
// This module never infers hiring, eligibility, pay, or availability from reachability alone.

function classifySourceEvidence(snapshot, previous = null) {
  if (!snapshot || typeof snapshot.url !== 'string') return 'UNKNOWN';

  if (snapshot.reachable === false) {
    if (previous && previous.reachable === true) return 'SOURCE_UNREACHABLE';
    return 'SOURCE_UNREACHABLE';
  }

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
  return {
    url: snapshot && typeof snapshot.url === 'string' ? snapshot.url : null,
    sourceStatus: classifySourceEvidence(snapshot, previous),
    changeStatus: summarizeChange(history),
    availability: 'NOT_VERIFIED',
    eligibility: 'NOT_VERIFIED',
    pay: 'NOT_VERIFIED',
    hiringStatus: 'NOT_VERIFIED'
  };
}

module.exports = {
  classifySourceEvidence,
  summarizeChange,
  makeOpportunityStatus
};
