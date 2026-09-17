const { makeHistoryRecord } = require('../lib/history-engine');
const { getHistoryStore } = require('../lib/history-store');
const { makeOpportunityStatus } = require('../lib/opportunity-status');

const store = getHistoryStore();

async function saveSnapshot(snapshot) {
  const previousRecord = await store.getLatest(snapshot.url);
  const previousSnapshot = previousRecord ? previousRecord.snapshot : null;
  const history = makeHistoryRecord(snapshot, previousSnapshot);
  await store.append(history);
  const opportunityStatus = makeOpportunityStatus(snapshot, previousSnapshot, history);
  return { previous: previousSnapshot, history, opportunityStatus };
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const url = typeof req.query?.url === 'string' ? req.query.url : '';
  if (!url) return res.status(400).json({ ok: false, error: 'Missing url' });

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ ok: false, error: 'Invalid url' });
  }
  if (parsed.protocol !== 'https:') return res.status(400).json({ ok: false, error: 'Only HTTPS URLs are allowed' });

  const started = Date.now();
  try {
    const r = await fetch(parsed.toString(), {
      method: 'GET',
      redirect: 'manual',
      headers: { 'User-Agent': 'AI-Opportunity-Radar-Recheck/1.4', 'Range': 'bytes=0-2048' }
    });
    const checkedAt = new Date().toISOString();
    const snapshot = {
      url: parsed.toString(),
      reachable: r.status >= 200 && r.status < 400,
      status: r.status,
      latencyMs: Date.now() - started,
      checkedAt
    };
    const saved = await saveSnapshot(snapshot);
    return res.status(200).json({
      ok: true,
      version: '1.4',
      snapshot,
      ...saved,
      storage: 'memory-only',
      durable: false,
      note: 'Opportunity status reflects source evidence and change detection only. It does not confirm job availability, eligibility, compensation, or hiring status.'
    });
  } catch (error) {
    const checkedAt = new Date().toISOString();
    const snapshot = {
      url: parsed.toString(),
      reachable: false,
      status: null,
      latencyMs: Date.now() - started,
      checkedAt,
      error: error instanceof Error ? error.message : 'request failed'
    };
    const saved = await saveSnapshot(snapshot);
    return res.status(200).json({
      ok: true,
      version: '1.4',
      snapshot,
      ...saved,
      storage: 'memory-only',
      durable: false,
      note: 'A failed fetch is a reachability signal only and does not prove a source or job is closed.'
    });
  }
};
