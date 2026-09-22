const { recheckAndRecord } = require('../lib/recheck-pipeline');
const { getHistoryStore, getHistoryStorageStatus } = require('../lib/history-store');
const { canonicalizeSourceUrl } = require('../lib/source-policy');

const MAX_URLS = 10;

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body); } catch (_) { return {}; }
}

function normalizeInputUrls(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((url) => typeof url === 'string')
    .map((url) => url.trim())
    .filter(Boolean))].slice(0, MAX_URLS);
}

function summarizeResult(result) {
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

async function runBatch(rawUrls, { store = getHistoryStore(), recheck = recheckAndRecord } = {}) {
  const input = normalizeInputUrls(rawUrls);
  const blocked = [];
  const accepted = [];
  const seen = new Set();

  for (const rawUrl of input) {
    try {
      const canonicalUrl = canonicalizeSourceUrl(rawUrl);
      const url = canonicalUrl.toString();
      if (seen.has(url)) continue;
      seen.add(url);

      const result = await recheck(url, store);
      accepted.push(summarizeResult(result));
    } catch (error) {
      blocked.push({
        url: rawUrl,
        code: error?.code || 'RECHECK_FAILED',
        error: error instanceof Error ? error.message : 'Batch recheck failed',
        statusCode: error?.statusCode || 500
      });
    }
  }

  return {
    ok: blocked.length === 0,
    maxUrls: MAX_URLS,
    requested: input.length,
    accepted: accepted.length,
    blocked: blocked.length,
    results: accepted,
    blockedResults: blocked
  };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      version: '3.4',
      error: 'POST only'
    });
  }

  const body = parseBody(req);
  const rawUrls = body.urls;

  if (!Array.isArray(rawUrls)) {
    return res.status(400).json({
      ok: false,
      version: '3.4',
      error: 'urls must be an array',
      maxUrls: MAX_URLS
    });
  }

  const report = await runBatch(rawUrls);
  const storage = getHistoryStorageStatus();

  return res.status(200).json({
    ok: report.ok,
    version: '3.4',
    ...report,
    storage: storage.storage,
    durable: storage.durable,
    note: 'Batch recheck refreshes supplied source URLs through the canonical evidence pipeline. It does not discover search results automatically and does not claim hiring truth.'
  });
};

module.exports.MAX_URLS = MAX_URLS;
module.exports.normalizeInputUrls = normalizeInputUrls;
module.exports.summarizeResult = summarizeResult;
module.exports.runBatch = runBatch;
