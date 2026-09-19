// MVP 1.8 — deterministic opportunity status from source evidence only.

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
  return history.changes.length === 0 ? 'NO_CHANGE' : 'CHANGED';
}

function makeOpportunityStatus(snapshot, previous, history) {
  const availability = snapshot?.availabilityEvidence?.status;
  const eligibility = snapshot?.eligibilityEvidence?.status;
  const compensation = snapshot?.compensationEvidence?.status;
  return {
    url: snapshot && typeof snapshot.url === 'string' ? snapshot.url : null,
    sourceStatus: classifySourceEvidence(snapshot, previous),
    changeStatus: summarizeChange(history),
    availability: new Set(['OPEN_EVIDENCE', 'CLOSED_EVIDENCE', 'CONFLICTING_EVIDENCE']).has(availability) ? availability : 'NOT_VERIFIED',
    eligibility: new Set(['PH_ELIGIBLE_EVIDENCE', 'PH_EXCLUDED_EVIDENCE', 'CONFLICTING_EVIDENCE']).has(eligibility) ? eligibility : 'NOT_VERIFIED',
    pay: compensation === 'COMPENSATION_EVIDENCE' ? 'COMPENSATION_EVIDENCE' : 'NOT_VERIFIED',
    hiringStatus: 'NOT_VERIFIED'
  };
}

module.exports = { classifySourceEvidence, summarizeChange, makeOpportunityStatus };
