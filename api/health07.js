export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  return res.status(200).json({
    ok: true,
    service: 'ai-opportunity-radar',
    version: '0.7',
    capability: 'change-detection',
    checkedAt: new Date().toISOString()
  });
}
