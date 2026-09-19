const { getHistoryStorageStatus } = require('../lib/history-store');
const { normalizeSnapshot, diffSnapshots, makeHistoryRecord } = require('../lib/history-engine');
const { makeOpportunityStatus } = require('../lib/opportunity-status');
const { canonicalizeSourceUrl, getSourcePolicyStatus } = require('../lib/source-policy');
const { classifyAvailability } = require('../lib/availability-evidence');
const { classifyPhEligibility } = require('../lib/ph-eligibility-evidence');
const { classifyCompensation } = require('../lib/compensation-evidence');
const { makeChangeAlerts } = require('../lib/change-alerts');
const { validateSavedSearch, matchesSavedSearch } = require('../lib/saved-searches');
const { getSavedSearchStorageStatus } = require('../lib/saved-search-store');
const { getIdentityStatus } = require('../lib/request-identity');
const { getAlertOutboxStatus } = require('../lib/alert-outbox');
const { getAlertDeliveryStatus } = require('../lib/alert-delivery');
const { getAlertSubscriptionStorageStatus } = require('../lib/alert-subscription-store');
const { getMonitoredSources, getMonitoredSourceStatus } = require('../lib/monitored-sources');
const { checkSource, recheckAndRecord } = require('../lib/recheck-pipeline');

// MVP 3.0 — public read-only runtime status.
module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const storage = getHistoryStorageStatus();
  const engineReady = [
    normalizeSnapshot, diffSnapshots, makeHistoryRecord, makeOpportunityStatus,
    classifyAvailability, classifyPhEligibility, classifyCompensation, makeChangeAlerts, validateSavedSearch, matchesSavedSearch
  ].every(fn => typeof fn === 'function');
  const pipelineReady = [canonicalizeSourceUrl, checkSource, recheckAndRecord]
    .every(fn => typeof fn === 'function');
  const policy = getSourcePolicyStatus();
  const ok = engineReady && pipelineReady && policy.httpsOnly && policy.credentialsBlocked && policy.allowlistSize > 0;

  return res.status(200).json({
    ok,
    service: 'ai-opportunity-radar',
    version: '3.0',
    checkedAt: new Date().toISOString(),
    runtime: {
      availabilityEvidence: typeof classifyAvailability === 'function',
      phEligibilityEvidence: typeof classifyPhEligibility === 'function',
      compensationEvidence: typeof classifyCompensation === 'function',
      changeAlerts: typeof makeChangeAlerts === 'function',
      alertInbox: true,
      identity: getIdentityStatus(),
      alertOutbox: getAlertOutboxStatus(),
      alertDelivery: getAlertDeliveryStatus(),
      alertDeliveryWorker: { enabled: true, path: '/api/alert-worker', requiresCronSecret: true },
      scheduledMonitor: { enabled: true, monitoredSources: getMonitoredSources().length, cronPath: '/api/monitor' },
      monitoredSourceLifecycle: getMonitoredSourceStatus(),
      savedSearchContract: typeof validateSavedSearch === 'function' && typeof matchesSavedSearch === 'function',
      canonicalPipeline: pipelineReady,
      sourcePolicy: policy,
      storage: storage.storage,
      durable: storage.durable,
      storageConfigured: storage.configured,
      savedSearchStorage: getSavedSearchStorageStatus(),
      alertSubscriptionStorage: getAlertSubscriptionStorageStatus()
    },
    verification: {
      systemHealth: ok,
      durableHistory: storage.durable ? 'configured' : 'not_verified',
      authenticatedIdentity: getIdentityStatus().configured ? 'provider-backed' : 'not_verified',
      durableAlertOutbox: getAlertOutboxStatus().durable ? 'configured' : 'not_verified',
      externalAlertDelivery: getAlertDeliveryStatus().configured ? 'provider-backed' : 'not_verified',
      alertDeliveryWorker: 'configured',
      scheduledMonitoring: 'configured',
      monitoredSourceLifecycle: 'configured',
      evidenceWatchlist: 'browser-local',
      providerExercise: { script: 'scripts/provider-exercise.js', requiresExplicitConfirmation: true },
      alertPreferences: 'browser-local-fallback',
      authenticatedAlertSubscriptions: getAlertSubscriptionStorageStatus().durable ? 'durable-provider-configured' : 'not_verified',
      evidenceTimeline: 'configured',
      providerPack: { history: getHistoryStorageStatus(), alertOutbox: getAlertOutboxStatus(), alertDelivery: getAlertDeliveryStatus() },
      jobAvailability: 'not_verified',
      phEligibility: 'not_verified',
      compensation: 'not_verified',
      hiringStatus: 'not_verified'
    },
    note: 'MVP 3.0 adds authenticated per-user alert subscriptions. The public browser-local preferences remain a fallback; authenticated users can persist alert categories through the identity and durable subscription provider boundary.'
  });
};
