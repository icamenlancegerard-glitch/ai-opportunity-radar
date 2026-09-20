const { recheckAndRecord } = require('../lib/recheck-pipeline');
const { getHistoryStorageStatus } = require('../lib/history-store');
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

  const suppliedUrl = req.method === 'POST'
    ? (req.body && typeof req.body.url === 'string' ? req.body.url : '')
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
