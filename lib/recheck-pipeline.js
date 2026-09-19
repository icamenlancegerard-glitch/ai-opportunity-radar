// MVP 1.8 — canonical source recheck pipeline.
// source policy → bounded content → availability evidence → PH eligibility evidence
// → compensation evidence → snapshot → history → change detection → opportunity status.

const { validateSourceUrl } = require('./source-policy');
const { classifyAvailability } = require('./availability-evidence');
const { classifyPhEligibility } = require('./ph-eligibility-evidence');
const { classifyCompensation } = require('./compensation-evidence');
const { makeHistoryRecord } = require('./history-engine');
const { getHistoryStore } = require('./history-store');
const { makeOpportunityStatus } = require('./opportunity-status');

const MAX_CONTENT_BYTES = 32768;

async function readBoundedText(response, maxBytes = MAX_CONTENT_BYTES) {
  if (response && typeof response.text === 'function' && !response.body) {
    const text = await response.text();
    return typeof text === 'string' ? text.slice(0, maxBytes) : '';
  }
  if (!response || !response.body || typeof response.body.getReader !== 'function') return '';
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (total < maxBytes) {
      const result = await reader.read();
      if (result.done) break;
      const raw = result.value instanceof Uint8Array ? result.value : new Uint8Array(result.value || []);
      const remaining = maxBytes - total;
      const chunk = raw.byteLength > remaining ? raw.slice(0, remaining) : raw;
      chunks.push(chunk);
      total += chunk.byteLength;
      if (chunk.byteLength < raw.byteLength) break;
    }
  } finally {
    if (typeof reader.cancel === 'function') {
      try { await reader.cancel(); } catch {}
    }
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(merged);
}

async function checkSource(rawUrl) {
  const target = validateSourceUrl(rawUrl);
  const started = Date.now();
  try {
    const response = await fetch(target.toString(), {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': 'AI-Opportunity-Radar-Recheck/1.8',
        'Range': 'bytes=0-' + (MAX_CONTENT_BYTES - 1)
      }
    });
    const bodyText = await readBoundedText(response);
    const availabilityEvidence = classifyAvailability(target.toString(), bodyText, response.status);
    const eligibilityEvidence = classifyPhEligibility(target.toString(), bodyText, response.status);
    const compensationEvidence = classifyCompensation(target.toString(), bodyText, response.status);
    return {
      url: target.toString(),
      reachable: response.status >= 200 && response.status < 400,
      status: response.status,
      latencyMs: Date.now() - started,
      checkedAt: new Date().toISOString(),
      availabilityEvidence,
      eligibilityEvidence,
      compensationEvidence
    };
  } catch (error) {
    return {
      url: target.toString(),
      reachable: false,
      status: null,
      latencyMs: Date.now() - started,
      checkedAt: new Date().toISOString(),
      availabilityEvidence: { status: 'NOT_VERIFIED', source: 'request_failed', matchedSignals: [] },
      eligibilityEvidence: { status: 'NOT_VERIFIED', source: 'request_failed', matchedSignals: [] },
      compensationEvidence: { status: 'NOT_VERIFIED', source: 'request_failed', matchedSignals: [] },
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
  return { snapshot, previous: previousSnapshot, history, opportunityStatus };
}

module.exports = { MAX_CONTENT_BYTES, readBoundedText, checkSource, recheckAndRecord };
