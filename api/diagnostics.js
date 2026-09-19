const {
  getHistoryStore,
  getHistoryStorageStatus
} = require('../lib/history-store');
const {
  normalizeSnapshot,
  diffSnapshots,
  makeHistoryRecord
} = require('../lib/history-engine');
const { makeOpportunityStatus } = require('../lib/opportunity-status');
const {
  canonicalizeSourceUrl,
  getSourcePolicyStatus
} = require('../lib/source-policy');
const {
  checkSource,
  recheckAndRecord
} = require('../lib/recheck-pipeline');

// MVP 1.5 — read-only runtime diagnostics for the canonical recheck pipeline.
module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const storage = getHistoryStorageStatus();
  const store = getHistoryStore();
  const sample = normalizeSnapshot({
    url: 'https://ph.indeed.com/viewjob?jk=diagnostic#fragment',
    reachable: true,
    status: 200,
    checkedAt: new Date().toISOString()
  });
  const diff = diffSnapshots(null, sample);
  const record = makeHistoryRecord(sample);
  const opportunityStatus = makeOpportunityStatus(sample, null, record);
  const policy = getSourcePolicyStatus();
  const pipelineReady = [canonicalizeSourceUrl, checkSource, recheckAndRecord]
    .every((fn) => typeof fn === 'function');

  return res.status(200).json({
    ok: true,
    service: 'ai-opportunity-radar',
    version: '1.5',
    checkedAt: new Date().toISOString(),
    capabilities: {
      canonicalPipeline: pipelineReady,
      sourcePolicy: policy,
      historyEngine: {
        normalizeSnapshot: typeof normalizeSnapshot === 'function',
        diffSnapshots: typeof diffSnapshots === 'function',
        makeHistoryRecord: typeof makeHistoryRecord === 'function'
      },
      opportunityStatus: typeof makeOpportunityStatus === 'function',
      historyStore: {
        available: !!store,
        getLatest: typeof store.getLatest === 'function',
        append: typeof store.append === 'function',
        list: typeof store.list === 'function',
        storage: storage.storage,
        durable: storage.durable
      }
    },
    selfTest: {
      canonicalUrl: canonicalizeSourceUrl(sample.url),
      firstRecordChanged: record.changed,
      diffChanges: diff.changes,
      sourceStatus: opportunityStatus.sourceStatus,
      availability: opportunityStatus.availability
    },
    note: 'Diagnostics prove module wiring and in-process capability only; they do not prove durable persistence or job availability.'
  });
};
