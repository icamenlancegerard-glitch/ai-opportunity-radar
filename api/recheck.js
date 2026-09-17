const ALLOWED_HOSTS = new Set([
  'ph.indeed.com',
  'ph.jobstreet.com',
  'ph.linkedin.com',
  'jobs.telusdigital.com',
  'careers-mci2.icims.com'
]);

function json(res, status, body) {
  res.status(status).setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify(body));
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const raw = typeof req.query?.url === 'string' ? req.query.url : '';
  if (!raw) return json(res, 400, { error: 'Missing url' });

  let target;
  try {
    target = new URL(raw);
  } catch {
    return json(res, 400, { error: 'Invalid URL' });
  }

  if (target.protocol !== 'https:' || !ALLOWED_HOSTS.has(target.hostname)) {
    return json(res, 403, { error: 'Source host is not allowlisted' });
  }

  const started = Date.now();
  try {
    const response = await fetch(target.href, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': 'AI-Opportunity-Radar-Recheck/0.5',
        'Range': 'bytes=0-2048'
      }
    });

    const reachable = response.status >= 200 && response.status < 400;
    return json(res, 200, {
      ok: true,
      reachable,
      status: response.status,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
      note: 'Reachability is not confirmation of job availability, eligibility, pay, or hiring status.'
    });
  } catch (error) {
    return json(res, 200, {
      ok: true,
      reachable: false,
      status: null,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : 'Source request failed',
      note: 'A failed request does not by itself prove that an opportunity is closed.'
    });
  }
};
