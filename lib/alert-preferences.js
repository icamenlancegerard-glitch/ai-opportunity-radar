// MVP 2.9 — user-selectable alert categories.
// Preferences are intentionally client-side until authenticated subscription sync exists.

const ALERT_GROUPS = Object.freeze({
  source: Object.freeze({
    label: 'Source health',
    codes: Object.freeze(['SOURCE_DOWN', 'SOURCE_RECOVERED'])
  }),
  availability: Object.freeze({
    label: 'Availability',
    codes: Object.freeze(['AVAILABILITY_OPENED', 'AVAILABILITY_CLOSED', 'AVAILABILITY_CONFLICTING'])
  }),
  eligibility: Object.freeze({
    label: 'Philippines eligibility',
    codes: Object.freeze(['PH_ELIGIBLE', 'PH_EXCLUDED', 'PH_ELIGIBILITY_CONFLICTING'])
  }),
  compensation: Object.freeze({
    label: 'Compensation',
    codes: Object.freeze(['COMPENSATION_STATED', 'COMPENSATION_REMOVED', 'COMPENSATION_CHANGED'])
  })
});

const ALL_ALERT_GROUPS = Object.freeze(Object.keys(ALERT_GROUPS));

function normalizeAlertPreferences(value) {
  if (!Array.isArray(value)) return [...ALL_ALERT_GROUPS];
  const selected = value.filter(group => ALL_ALERT_GROUPS.includes(group));
  return selected.length ? [...new Set(selected)] : [...ALL_ALERT_GROUPS];
}

function groupForAlertCode(code) {
  return ALL_ALERT_GROUPS.find(group => ALERT_GROUPS[group].codes.includes(code)) || null;
}

function filterAlertsByPreferences(alerts, preferences) {
  const selected = new Set(normalizeAlertPreferences(preferences));
  return (Array.isArray(alerts) ? alerts : []).filter(alert => {
    const group = groupForAlertCode(alert?.code);
    return group ? selected.has(group) : true;
  });
}

module.exports = {
  ALERT_GROUPS,
  ALL_ALERT_GROUPS,
  normalizeAlertPreferences,
  groupForAlertCode,
  filterAlertsByPreferences
};
