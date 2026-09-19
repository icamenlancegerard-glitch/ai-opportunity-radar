const { getMonitoredSources, getMonitoredSourceStatus } = require('../lib/monitored-sources');

// MVP 2.6 — read-only monitored source registry surface.
// Lifecycle mutation remains configuration-backed until durable source management exists.
module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'GET only' });

  return res.status(200).json({
    ok: true,
    version: '2.6',
    status: getMonitoredSourceStatus(),
    sources: getMonitoredSources({ includeInactive: true })
  });
};
