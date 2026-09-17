const SOURCES = [
  'https://ph.indeed.com/viewjob?jk=03a8507824d49250',
  'https://ph.indeed.com/viewjob?jk=a7d4a2a28797af71',
  'https://ph.jobstreet.com/job/94200540',
  'https://ph.jobstreet.com/job/94235501',
  'https://jobs.telusdigital.com/search/cfm5/customer-experience-cx/jobs/in/country/philippines?ns_category=artificial-intelligence'
];

const { makeHistoryRecord } = require('../lib/history-engine');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const results = await Promise.all(SOURCES.map(async url => {
    const started = Date.now();
    try {
      const r = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        headers: { 'User-Agent': 'AI-Opportunity-Radar-Recheck/0.9', 'Range': 'bytes=0-2048' }
      });
      return { url, reachable: r.status >= 200 && r.status < 400, status: r.status, latencyMs: Date.now() - started };
    } catch (error) {
      return { url, reachable: false, status: null, latencyMs: Date.now() - started, error: error instanceof Error ? error.message : 'request failed' };
    }
  }));

  const checkedAt = new Date().toISOString();
  const history = results.map(result => makeHistoryRecord({ ...result, checkedAt }));

  return res.status(200).json({
    ok: true,
    version: '0.9',
    checkedAt,
    count: results.length,
    reachable: results.filter(x => x.reachable).length,
    results,
    history,
    note: 'History is normalized in-process only. Persistent storage is not configured. Reachability does not confirm job availability, eligibility, compensation, or hiring status.'
  });
};
