// MVP 0.8 persistence-ready history adapter.
// Vercel/serverless instances are ephemeral, so this endpoint deliberately
// returns a normalized snapshot contract rather than pretending in-memory
// state is durable. A database can implement this contract later.

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      version: '0.8',
      storage: 'not-configured',
      records: [],
      note: 'Persistent storage is not configured. No historical records are fabricated.'
    });
  }

  if (req.method === 'POST') {
    const body = typeof req.body === 'object' && req.body ? req.body : {};
    const { url, reachable, status, checkedAt } = body;
    if (typeof url !== 'string' || typeof reachable !== 'boolean') {
      return res.status(400).json({ error: 'url and reachable are required' });
    }
    return res.status(501).json({
      ok: false,
      version: '0.8',
      storage: 'not-configured',
      error: 'Persistent storage is not configured; snapshot was not saved.',
      candidate: { url, reachable, status: status ?? null, checkedAt: checkedAt ?? new Date().toISOString() }
    });
  }

  return res.status(405).json({ error: 'GET or POST only' });
}
