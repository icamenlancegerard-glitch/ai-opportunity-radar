// MVP 2.3 — authenticated request identity boundary.
// The Radar never treats a client-supplied owner id as authentication.
// Configure RADAR_IDENTITY_PROVIDER_URL to an HTTPS provider exposing GET /me.

function getBearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  const match = /^Bearer\\s+([^\\s]+)$/i.exec(String(header).trim());
  return match ? match[1] : '';
}

function validateSubject(value) {
  const subject = typeof value === 'string' ? value.trim() : '';
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(subject)) {
    const error = new Error('Identity provider returned an invalid subject');
    error.code = 'IDENTITY_SUBJECT_INVALID';
    error.statusCode = 502;
    throw error;
  }
  return subject;
}

function getIdentityProviderUrl() {
  const raw = process.env.RADAR_IDENTITY_PROVIDER_URL || '';
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return null;
    return url;
  } catch (_) {
    return null;
  }
}

async function resolveRequestIdentity(req) {
  const token = getBearerToken(req);
  if (!token) {
    const error = new Error('Authentication required');
    error.code = 'IDENTITY_REQUIRED';
    error.statusCode = 401;
    throw error;
  }

  const baseUrl = getIdentityProviderUrl();
  if (!baseUrl) {
    const error = new Error('Identity provider is not configured');
    error.code = 'IDENTITY_PROVIDER_NOT_CONFIGURED';
    error.statusCode = 503;
    throw error;
  }

  let response;
  try {
    response = await fetch(new URL('/me', baseUrl), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`
      }
    });
  } catch (_) {
    const error = new Error('Identity provider is unreachable');
    error.code = 'IDENTITY_PROVIDER_UNREACHABLE';
    error.statusCode = 502;
    throw error;
  }

  let data = {};
  try { data = await response.json(); } catch (_) {}

  if (response.status === 401 || response.status === 403) {
    const error = new Error('Authentication rejected');
    error.code = 'IDENTITY_REJECTED';
    error.statusCode = 401;
    throw error;
  }
  if (!response.ok) {
    const error = new Error(`Identity provider returned HTTP ${response.status}`);
    error.code = 'IDENTITY_PROVIDER_ERROR';
    error.statusCode = 502;
    throw error;
  }

  const subject = validateSubject(data.subject);
  return {
    subject,
    provider: 'HTTPS identity provider',
    authenticated: true
  };
}

function getIdentityStatus() {
  const configuredUrl = getIdentityProviderUrl();
  return {
    configured: Boolean(configuredUrl),
    provider: 'HTTPS identity provider',
    authentication: configuredUrl ? 'provider-backed' : 'not-configured'
  };
}

module.exports = {
  getBearerToken,
  validateSubject,
  getIdentityProviderUrl,
  resolveRequestIdentity,
  getIdentityStatus
};
