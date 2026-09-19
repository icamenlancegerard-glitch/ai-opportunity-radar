const { getHistoryStorageStatus } = require('../lib/history-store');
const { normalizeSnapshot, diffSnapshots, makeHistoryRecord } = require('../lib/history-engine');
const { makeOpportunityStatus } = require('../lib/opportunity-status');
const { canonicalizeSourceUrl, getSourcePolicyStatus } = require('../lib/source-policy');
const { checkSource, recheckAndRecord } = require('../lib/recheck-pipeline');

// MVP 1.5 — public read-only runtime status. No job availability is claimed.
module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const storage = getHistoryStorageStatus();
  const storeReady = typeof storage.storage === 'string';
  const engineReady = [normalizeSnapshot, diffSnapshots, makeHistoryRecord, makeOpportunityStatus]
    .every((fn) => typeof fn === 'function');
  const pipelineReady = [canonicalizeSourceUrl, checkSource, recheckAndRecord]
    .every((fn) => typeof fn === 'function');
  const policy = getSourcePolicyStatus();

  const ok = engineReady && storeReady && pipelineReady && policy.httpsOnly && policy.credentialsBlocked && policy.allowlistSize > 0;

  return res.status(200).json({
    ok,
    service: 'ai-opportunity-radar',
    version: '1.5',
    checkedAt: new Date().toISOString(),
    runtime: {
      historyEngine: engineReady,
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
    note: 'System health and source reachability remain separate from job availability, eligibility, pay, and hiring status.'
  });
};
