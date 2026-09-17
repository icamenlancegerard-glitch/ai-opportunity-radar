export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  // MVP 0.7: deterministic change classification for recheck results.
  // This endpoint does not claim job availability; it only compares observed
  // source reachability states supplied by the caller.
  const previous = String(req.query.previous || '').toLowerCase();
  const current = String(req.query.current || '').toLowerCase();

  const allowed = new Set(['reachable', 'unreachable', 'unknown']);
  if (!allowed.has(previous) || !allowed.has(current)) {
    return res.status(400).json({
      error: 'previous and current must be reachable, unreachable, or unknown'
    });
  }

  let change = 'NO_CHANGE';
  if (previous !== current) {
    if (previous === 'unknown' || current === 'unknown') change = 'REVIEW';
    else if (current === 'unreachable') change = 'SOURCE_DOWN';
    else if (previous === 'unreachable' && current === 'reachable') change = 'SOURCE_RECOVERED';
  }

  return res.status(200).json({
    ok: true,
    previous,
    current,
    change,
    checkedAt: new Date().toISOString(),
    note: 'Change detection describes source reachability only. It does not confirm job availability, eligibility, compensation, or hiring status.'
  });
}
