const { getHistoryStore, getHistoryStorageStatus } = require('../lib/history-store');
const { normalizeSnapshot, diffSnapshots, makeHistoryRecord } = require('../lib/history-engine');
const { makeOpportunityStatus } = require('../lib/opportunity-status');
const { canonicalizeSourceUrl, getSourcePolicyStatus } = require('../lib/source-policy');
const { classifyAvailability } = require('../lib/availability-evidence');
const { checkSource, recheckAndRecord } = require('../lib/recheck-pipeline');

// MVP 1.6 — read-only runtime diagnostics.
module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const storage = getHistoryStorageStatus();
  const store = getHistoryStore();
  const sampleUrl = 'https://ph.indeed.com/viewjob?jk=diagnostic#fragment';
  const sample = normalizeSnapshot({
    url: sampleUrl,
    reachable: true,
    status: 200,
    checkedAt: new Date().toISOString(),
    availabilityEvidence: classifyAvailability(sampleUrl, '<button>Apply now</button>', 200)
  });
  const diff = diffSnapshots(null, sample);
  const record = makeHistoryRecord(sample);
  const opportunityStatus = makeOpportunityStatus(sample, null, record);
  const policy = getSourcePolicyStatus();
  const pipelineReady = [canonicalizeSourceUrl, classifyAvailability, checkSource, recheckAndRecord]
    .every((fn) => typeof fn === 'function');

  return res.status(200).json({
    ok: true,
    service: 'ai-opportunity-radar',
    version: '1.6',
    checkedAt: new Date().toISOString(),
    capabilities: {
      canonicalPipeline: pipelineReady,
      availabilityEvidence: typeof classifyAvailability === 'function',
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
      canonicalUrl: canonicalizeSourceUrl(sampleUrl),
      firstRecordChanged: record.changed,
      diffChanges: diff.changes,
      sourceStatus: opportunityStatus.sourceStatus,
      availability: opportunityStatus.availability
    },
    note: 'Diagnostics prove module wiring and bounded evidence classification only; they do not prove durable persistence or job availability.'
  });
};
