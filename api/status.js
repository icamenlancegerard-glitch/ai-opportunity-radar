const { getHistoryStorageStatus } = require('../lib/history-store');
const { normalizeSnapshot, diffSnapshots, makeHistoryRecord } = require('../lib/history-engine');
const { makeOpportunityStatus } = require('../lib/opportunity-status');
const { canonicalizeSourceUrl, getSourcePolicyStatus } = require('../lib/source-policy');
const { classifyAvailability } = require('../lib/availability-evidence');
const { classifyPhEligibility } = require('../lib/ph-eligibility-evidence');
const { classifyCompensation } = require('../lib/compensation-evidence');
const { makeChangeAlerts } = require('../lib/change-alerts');
const { validateSavedSearch, matchesSavedSearch } = require('../lib/saved-searches');
const { checkSource, recheckAndRecord } = require('../lib/recheck-pipeline');

// MVP 2.0 — public read-only runtime status.
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
    version: '2.0',
    checkedAt: new Date().toISOString(),
    runtime: {
      availabilityEvidence: typeof classifyAvailability === 'function',
      phEligibilityEvidence: typeof classifyPhEligibility === 'function',
      compensationEvidence: typeof classifyCompensation === 'function',
      changeAlerts: typeof makeChangeAlerts === 'function',
      savedSearchContract: typeof validateSavedSearch === 'function' && typeof matchesSavedSearch === 'function',
      canonicalPipeline: pipelineReady,
      sourcePolicy: policy,
      storage: storage.storage,
      durable: storage.durable,
      storageConfigured: storage.configured
    },
    verification: {
      systemHealth: ok,
      durableHistory: storage.durable ? 'configured' : 'not_verified',
      jobAvailability: 'not_verified',
      phEligibility: 'not_verified',
      compensation: 'not_verified',
      hiringStatus: 'not_verified'
    },
    note: 'MVP 2.0 provides deterministic change-alert events and browser-side saved-search support; external notifications are not sent.'
  });
};
