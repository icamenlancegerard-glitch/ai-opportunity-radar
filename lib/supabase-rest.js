// MVP 2.8 — Supabase REST helper.
// Server-side only. Never expose the service-role key to the browser.
function getSupabaseConfig(env = process.env) {
  const baseUrl = typeof env.RADAR_SUPABASE_URL === 'string' ? env.RADAR_SUPABASE_URL.trim() : '';
  const serviceRoleKey = typeof env.RADAR_SUPABASE_SERVICE_ROLE_KEY === 'string'
    ? env.RADAR_SUPABASE_SERVICE_ROLE_KEY.trim()
    : '';

  if (!baseUrl || !serviceRoleKey) return null;

  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch (_) {
    return null;
  }

  if (parsed.protocol !== 'https:') return null;

  return { baseUrl: parsed.toString().replace(/\/+$/, ''), serviceRoleKey };
}

function createSupabaseRestClient({ baseUrl, serviceRoleKey }) {
  const config = getSupabaseConfig({ RADAR_SUPABASE_URL: baseUrl, RADAR_SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey });
  if (!config) throw new Error('Supabase requires an HTTPS URL and service-role key');

  const root = config.baseUrl + '/rest/v1';
  const headers = {
    Accept: 'application/json',
    apikey: config.serviceRoleKey,
    Authorization: 'Bearer ' + config.serviceRoleKey
  };

  async function request(path, options = {}) {
    const response = await fetch(root + path, {
      ...options,
      headers: {
        ...headers,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {})
      }
    });

    let body = null;
    try { body = await response.json(); } catch (_) {}

    if (!response.ok) {
      const detail = body?.message || body?.hint || body?.details || body?.error || 'Supabase request failed';
      const error = new Error(detail + ' (HTTP ' + response.status + ')');
      error.code = 'SUPABASE_HTTP_ERROR';
      error.statusCode = 502;
      throw error;
    }

    return body;
  }

  return { request, baseUrl: config.baseUrl };
}

function getConfiguredSupabaseClient(env = process.env) {
  const config = getSupabaseConfig(env);
  return config ? createSupabaseRestClient(config) : null;
}

module.exports = {
  getSupabaseConfig,
  createSupabaseRestClient,
  getConfiguredSupabaseClient
};
