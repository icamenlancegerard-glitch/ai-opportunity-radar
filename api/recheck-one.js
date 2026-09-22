const { recheckAndRecord } = require('../lib/recheck-pipeline');
const { getHistoryStore, getHistoryStorageStatus } = require('../lib/history-store');
const { canonicalizeSourceUrl } = require('../lib/source-policy');
const { makeChangeAlerts } = require('../lib/change-alerts');

const MAX_TEXT = 160;
const TYPES = new Set(['Evaluator', 'Prompt', 'Content', 'Engineering', 'AI Training', 'Unknown']);
const MODES = new Set(['Remote', 'Hybrid', 'Unclear', 'Unknown']);

function cleanText(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const text = value.trim().slice(0, MAX_TEXT);
  return text || fallback;
}

function candidateStatus(status = {}) {
  if (status.sourceStatus === 'SOURCE_UNREACHABLE') return 'investigate';
  const values = [status.availability, status.eligibility, status.pay];
  if (values.some((value) => value === 'CONFLICTING' || value === 'NOT_VERIFIED')) return 'investigate';
  return 'recorded';
}

const MAX_BATCH_URLS = 10;

function normalizeBatchUrls(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((url) => typeof url === 'string')
    .map((url) => url.trim())
    .filter(Boolean))].slice(0, MAX_BATCH_URLS);
}

function summarizeBatchResult(result) {
  const status = result.opportunityStatus || {};
  return {
    url: result.snapshot.url,
    checkedAt: result.snapshot.checkedAt,
    reachable: result.snapshot.reachable === true,
    httpStatus: result.snapshot.status,
    sourceStatus: status.sourceStatus || 'UNKNOWN',
    availability: status.availability || 'NOT_VERIFIED',
    eligibility: status.eligibility || 'NOT_VERIFIED',
    pay: status.pay || 'NOT_VERIFIED',
    hiringStatus: status.hiringStatus || 'NOT_VERIFIED',
    changes: Array.isArray(result.history?.changes) ? result.history.changes : [],
    changed: result.history?.changed === true
  };
}

async function runBatch(rawUrls, { store = getHistoryStore() } = {}) {
  const input = normalizeBatchUrls(rawUrls);
  const results = [];
  const blockedResults = [];
  const seen = new Set();

  for (const rawUrl of input) {
    try {
      const canonicalUrl = canonicalizeSourceUrl(rawUrl).toString();
      if (seen.has(canonicalUrl)) continue;
      seen.add(canonicalUrl);
      results.push(summarizeBatchResult(await recheckAndRecord(canonicalUrl, store)));
    } catch (error) {
      blockedResults.push({
        url: rawUrl,
        code: error?.code || 'RECHECK_FAILED',
        error: error instanceof Error ? error.message : 'Batch recheck failed',
        statusCode: error?.statusCode || 500
      });
    }
  }

  return {
    ok: blockedResults.length === 0,
    maxUrls: MAX_BATCH_URLS,
    requested: input.length,
    accepted: results.length,
    blocked: blockedResults.length,
    results,
    blockedResults
  };
}

function makeCandidate(body, result) {
  const status = result.opportunityStatus || {};
  const type = TYPES.has(body.type) ? body.type : 'Unknown';
  const mode = MODES.has(body.mode) ? body.mode : 'Unknown';
  const company = cleanText(body.company, 'Unknown company');
  const title = cleanText(body.title, 'Untitled opportunity');
  const location = cleanText(body.location, 'Unknown location');
  const pay = cleanText(body.pay, 'Not verified');
  const url = result.snapshot.url;

  return {
    company,
    title,
    type,
    mode,
    location,
    pay,
    tags: [type, mode, location, pay].filter(Boolean).slice(0, 4),
    status: candidateStatus(status),
    lastChecked: result.snapshot.checkedAt.slice(0, 10),
    evidence: 'Candidate passed source policy and was rechecked through the canonical evidence pipeline. Availability, Philippines eligibility, compensation, and continued hiring remain evidence-gated.',
    url,
    discovery: {
      source: cleanText(body.discoverySource, 'user-intake'),
      canonicalized: typeof body.url === 'string' ? result.snapshot.url !== body.url.trim() : false,
      status: 'candidate-rechecked'
    }
  };
}

module.exports = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const body = req.method === 'POST' && req.body && typeof req.body === 'object'
    ? req.body
    : {};

  if (req.method === 'POST' && Array.isArray(body.urls)) {
    const report = await runBatch(body.urls);
    const storage = getHistoryStorageStatus();

    return res.status(200).json({
      ok: report.ok,
      version: '3.4',
      mode: 'batch',
      ...report,
      storage: storage.storage,
      durable: storage.durable,
      note: 'Batch recheck refreshes supplied source URLs through the canonical evidence pipeline. It does not discover search results automatically and does not claim hiring truth.'
    });
  }

  const suppliedUrl = req.method === 'POST'
    ? (body && typeof body.url === 'string' ? body.url : '')
    : (typeof req.query?.url === 'string' ? req.query.url : '');

  if (!suppliedUrl) return res.status(400).json({ ok: false, error: 'Missing url' });

  try {
    const result = await recheckAndRecord(suppliedUrl);
    const storage = getHistoryStorageStatus();
    const alerts = makeChangeAlerts(result.history);

    const payload = {
      ok: true,
      version: req.method === 'POST' ? '3.3' : '2.0',
      ...result,
      alerts,
      storage: storage.storage,
      durable: storage.durable,
      note: 'The canonical pipeline derives evidence, history, and deterministic change alerts. Alerts summarize evidence changes; they do not guarantee hiring, eligibility, compensation, or continued availability.'
    };

    if (req.method === 'POST') {
      payload.candidate = makeCandidate(req.body || {}, result);
      payload.canonicalUrl = result.snapshot.url;
      payload.discoveryIntake = true;
    }

    return res.status(200).json(payload);
  } catch (error) {
    const status = error && error.code === 'SOURCE_POLICY_REJECTED'
      ? (error.statusCode || 400)
      : 500;
    return res.status(status).json({ ok: false, error: error instanceof Error ? error.message : 'Recheck failed' });
  }
};

module.exports.MAX_BATCH_URLS = MAX_BATCH_URLS;
module.exports.normalizeBatchUrls = normalizeBatchUrls;
module.exports.summarizeBatchResult = summarizeBatchResult;
module.exports.runBatch = runBatch;
