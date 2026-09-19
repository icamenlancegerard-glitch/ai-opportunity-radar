const { getHistoryStorageStatus } = require('../lib/history-store');
const { normalizeSnapshot, diffSnapshots, makeHistoryRecord } = require('../lib/history-engine');
const { makeOpportunityStatus } = require('../lib/opportunity-status');
const { canonicalizeSourceUrl, getSourcePolicyStatus } = require('../lib/source-policy');
const { classifyAvailability } = require('../lib/availability-evidence');
const { checkSource, recheckAndRecord } = require('../lib/recheck-pipeline');

// MVP 1.6 — public read-only runtime status.
module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const storage = getHistoryStorageStatus();
  const engineReady = [normalizeSnapshot, diffSnapshots, makeHistoryRecord, makeOpportunityStatus, classifyAvailability]
    .every((fn) => typeof fn === 'function');
  const pipelineReady = [canonicalizeSourceUrl, checkSource, recheckAndRecord]
    .every((fn) => typeof fn === 'function');
  const policy = getSourcePolicyStatus();
  const ok = engineReady && pipelineReady && policy.httpsOnly && policy.credentialsBlocked && policy.allowlistSize > 0;

  return res.status(200).json({
    ok,
    service: 'ai-opportunity-radar',
    version: '1.6',
    checkedAt: new Date().toISOString(),
    runtime: {
      availabilityEvidence: engineReady,
      canonicalPipeline: pipelineReady,
      sourcePolicy: policy,
      storage: storage.storage,
      durable: storage.durable
    },
    verification: {
      systemHealth: ok,
      jobAvailability: 'not_verified',
      eligibility: 'not_verified',
      compensation: 'not_verified',
      hiringStatus: 'not_verified'
    },
    note: 'Availability evidence is separate from final job availability, eligibility, pay, and hiring status.'
  });
};
