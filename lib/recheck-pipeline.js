// MVP 1.5 — canonical source recheck pipeline.
// source policy → snapshot → history → change detection → opportunity status.

const { validateSourceUrl } = require('./source-policy');
const { makeHistoryRecord } = require('./history-engine');
const { getHistoryStore } = require('./history-store');
const { makeOpportunityStatus } = require('./opportunity-status');

async function checkSource(rawUrl) {
  const target = validateSourceUrl(rawUrl);
  const started = Date.now();

  try {
    const response = await fetch(target.toString(), {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': 'AI-Opportunity-Radar-Recheck/1.5',
        'Range': 'bytes=0-2048'
      }
    });

    return {
      url: target.toString(),
      reachable: response.status >= 200 && response.status < 400,
      status: response.status,
      latencyMs: Date.now() - started,
      checkedAt: new Date().toISOString()
    };
  } catch (error) {
    return {
      url: target.toString(),
      reachable: false,
      status: null,
      latencyMs: Date.now() - started,
      checkedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'request failed'
    };
  }
}

async function recheckAndRecord(rawUrl, store = getHistoryStore()) {
  const snapshot = await checkSource(rawUrl);
  const previousRecord = await store.getLatest(snapshot.url);
  const previousSnapshot = previousRecord ? previousRecord.snapshot : null;
  const history = makeHistoryRecord(snapshot, previousSnapshot);
  await store.append(history);
  const opportunityStatus = makeOpportunityStatus(snapshot, previousSnapshot, history);

  return {
    snapshot,
    previous: previousSnapshot,
    history,
    opportunityStatus
  };
}

module.exports = {
  checkSource,
  recheckAndRecord
};
