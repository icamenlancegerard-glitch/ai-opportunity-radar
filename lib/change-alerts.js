// MVP 2.0 — deterministic change alerts.
// Converts a history record into actionable event labels.
// No notification transport or ranking is implied here.

const EVENT_RULES = Object.freeze({
  SOURCE_DOWN: { code: 'SOURCE_DOWN', severity: 'warning', title: 'Source became unreachable' },
  SOURCE_RECOVERED: { code: 'SOURCE_RECOVERED', severity: 'info', title: 'Source recovered' },
  AVAILABILITY_OPENED: { code: 'AVAILABILITY_OPENED', severity: 'info', title: 'Open availability evidence detected' },
  AVAILABILITY_CLOSED: { code: 'AVAILABILITY_CLOSED', severity: 'warning', title: 'Closed availability evidence detected' },
  AVAILABILITY_CONFLICTING: { code: 'AVAILABILITY_CONFLICTING', severity: 'warning', title: 'Conflicting availability evidence detected' },
  PH_ELIGIBLE: { code: 'PH_ELIGIBLE', severity: 'info', title: 'Philippines eligibility evidence detected' },
  PH_EXCLUDED: { code: 'PH_EXCLUDED', severity: 'warning', title: 'Philippines exclusion evidence detected' },
  PH_ELIGIBILITY_CONFLICTING: { code: 'PH_ELIGIBILITY_CONFLICTING', severity: 'warning', title: 'Conflicting Philippines eligibility evidence detected' },
  COMPENSATION_STATED: { code: 'COMPENSATION_STATED', severity: 'info', title: 'Compensation evidence detected' },
  COMPENSATION_REMOVED: { code: 'COMPENSATION_REMOVED', severity: 'warning', title: 'Compensation evidence is no longer present' },
  COMPENSATION_CHANGED: { code: 'COMPENSATION_CHANGED', severity: 'warning', title: 'Compensation evidence changed' }
});

function makeEvent(rule, history) {
  return {
    code: rule.code,
    severity: rule.severity,
    title: rule.title,
    url: history?.snapshot?.url || null,
    checkedAt: history?.snapshot?.checkedAt || null
  };
}

function makeChangeAlerts(history) {
  if (!history || history.changed !== true) return [];

  const current = history.snapshot || {};
  const previous = history.previous || {};
  const events = [];

  if (history.changes.includes('SOURCE_DOWN')) events.push(makeEvent(EVENT_RULES.SOURCE_DOWN, history));
  if (history.changes.includes('SOURCE_RECOVERED')) events.push(makeEvent(EVENT_RULES.SOURCE_RECOVERED, history));

  const currentAvailability = current.availabilityEvidence?.status;
  const previousAvailability = previous.availabilityEvidence?.status;
  if (currentAvailability === 'OPEN_EVIDENCE' && previousAvailability !== 'OPEN_EVIDENCE') {
    events.push(makeEvent(EVENT_RULES.AVAILABILITY_OPENED, history));
  } else if (currentAvailability === 'CLOSED_EVIDENCE' && previousAvailability !== 'CLOSED_EVIDENCE') {
    events.push(makeEvent(EVENT_RULES.AVAILABILITY_CLOSED, history));
  } else if (currentAvailability === 'CONFLICTING_EVIDENCE' && previousAvailability !== 'CONFLICTING_EVIDENCE') {
    events.push(makeEvent(EVENT_RULES.AVAILABILITY_CONFLICTING, history));
  }

  const currentEligibility = current.eligibilityEvidence?.status;
  const previousEligibility = previous.eligibilityEvidence?.status;
  if (currentEligibility === 'PH_ELIGIBLE_EVIDENCE' && previousEligibility !== 'PH_ELIGIBLE_EVIDENCE') {
    events.push(makeEvent(EVENT_RULES.PH_ELIGIBLE, history));
  } else if (currentEligibility === 'PH_EXCLUDED_EVIDENCE' && previousEligibility !== 'PH_EXCLUDED_EVIDENCE') {
    events.push(makeEvent(EVENT_RULES.PH_EXCLUDED, history));
  } else if (currentEligibility === 'CONFLICTING_EVIDENCE' && previousEligibility !== 'CONFLICTING_EVIDENCE') {
    events.push(makeEvent(EVENT_RULES.PH_ELIGIBILITY_CONFLICTING, history));
  }

  const currentPay = current.compensationEvidence?.status;
  const previousPay = previous.compensationEvidence?.status;
  if (currentPay === 'COMPENSATION_EVIDENCE' && previousPay !== 'COMPENSATION_EVIDENCE') {
    events.push(makeEvent(EVENT_RULES.COMPENSATION_STATED, history));
  } else if (currentPay !== 'COMPENSATION_EVIDENCE' && previousPay === 'COMPENSATION_EVIDENCE') {
    events.push(makeEvent(EVENT_RULES.COMPENSATION_REMOVED, history));
  } else if (
    history.changes.includes('COMPENSATION_EVIDENCE_CHANGED') &&
    currentPay === 'COMPENSATION_EVIDENCE' &&
    previousPay === 'COMPENSATION_EVIDENCE'
  ) {
    events.push(makeEvent(EVENT_RULES.COMPENSATION_CHANGED, history));
  }

  return events;
}

module.exports = { EVENT_RULES, makeChangeAlerts };
