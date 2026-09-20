// MVP 3.3 — Discovery Intake v1.
// Intake is deliberately evidence-gated: candidate metadata never becomes a
// Radar opportunity until the source URL passes policy and the canonical
// recheck pipeline returns an evidence record.
//
// This endpoint does not perform web search or claim job truth. It accepts a
// candidate discovered elsewhere, canonicalizes its URL, runs the same
// evidence pipeline used by monitored sources, and returns a session-ready
// Radar record.

const { canonicalizeSourceUrl } = require('../lib/source-policy');
const { recheckAndRecord } = require('../lib/recheck-pipeline');
const { makeChangeAlerts } = require('../lib/change-alerts');
const { getHistoryStorageStatus } = require('../lib/history-store');

const MAX_TEXT = 160;
const ALLOWED_TYPES = new Set(['Evaluator', 'Prompt', 'Content', 'Engineering', 'AI Training', 'Unknown']);
const ALLOWED_MODES = new Set(['Remote', 'Hybrid', 'Unclear', 'Unknown']);

function cleanText(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  return value.trim().slice(0, MAX_TEXT);
}

function classifyStatus(opportunityStatus = {}) {
  const sourceStatus = opportunityStatus.sourceStatus || 'UNKNOWN';
  const availability = opportunityStatus.availability || 'NOT_VERIFIED';
  const eligibility = opportunityStatus.eligibility || 'NOT_VERIFIED';
  const pay = opportunityStatus.pay || 'NOT_VERIFIED';

  if (sourceStatus === 'SOURCE_UNREACHABLE') return 'investigate';
  if ([availability, eligibility, pay].some((value) => value === 'CONFLICTING')) return 'investigate';
  if ([availability, eligibility, pay].some((value) => value === 'NOT_VERIFIED')) return 'investigate';
  return 'recorded';
}

function makeTags({ type, mode, location, pay }) {
  return [type, mode, location, pay]
    .filter(Boolean)
    .map((value) => String(value).slice(0, 60));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const rawUrl = typeof body.url === 'string' ? body.url : '';
    if (!rawUrl.trim()) {
      return res.status(400).json({ ok: false, error: 'Missing url' });
    }

    const url = canonicalizeSourceUrl(rawUrl);
    const result = await recheckAndRecord(url);
    const alerts = makeChangeAlerts(result.history);
    const s = result.opportunityStatus || {};

    const type = ALLOWED_TYPES.has(body.type) ? body.type : 'Unknown';
    const mode = ALLOWED_MODES.has(body.mode) ? body.mode : 'Unknown';
    const company = cleanText(body.company, 'Unknown company') || 'Unknown company';
    const title = cleanText(body.title, 'Untitled opportunity') || 'Untitled opportunity';
    const location = cleanText(body.location, 'Unknown location') || 'Unknown location';
    const pay = cleanText(body.pay, 'Not verified') || 'Not verified';

    const opportunity = {
      company,
      title,
      type,
      mode,
      location,
      pay,
      tags: makeTags({ type, mode, location, pay }),
      status: classifyStatus(s),
      lastChecked: result.snapshot.checkedAt.slice(0, 10),
      evidence:
        'Discovery candidate accepted by source policy and rechecked through the canonical evidence pipeline. ' +
        'Availability, Philippines eligibility, compensation, and continued hiring remain evidence-gated.',
      url,
      discovery: {
        source: cleanText(body.discoverySource, 'user-intake') || 'user-intake',
        canonicalized: url !== rawUrl.trim(),
        status: 'candidate-rechecked'
      }
    };

    return res.status(200).json({
      ok: true,
      version: '3.3',
      candidate: opportunity,
      canonicalUrl: url,
      sourceSnapshot: result.snapshot,
      opportunityStatus: result.opportunityStatus,
      history: result.history,
      alerts,
      storage: getHistoryStorageStatus(),
      note: 'Discovery Intake v1 turns a discovered URL into a canonical, evidence-gated Radar candidate. It does not perform external search or prove hiring truth.'
    });
  } catch (error) {
    const status = error && error.code === 'SOURCE_POLICY_REJECTED'
      ? (error.statusCode || 400)
      : 500;
    return res.status(status).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Discovery intake failed'
    });
  }
};
