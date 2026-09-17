module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
  }

  res.status(200).setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify({
    ok: true,
    service: 'ai-opportunity-radar',
    version: '0.6',
    checkedAt: new Date().toISOString()
  }));
};
