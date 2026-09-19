const { resolveRequestIdentity, getIdentityStatus } = require('../lib/request-identity');

// MVP 2.3 — authenticated session introspection.
// This endpoint never creates an identity; it only verifies one through the configured provider.
module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'GET only' });

  if (!getIdentityStatus().configured) {
    return res.status(503).json({
      ok: false,
      version: '2.3',
      code: 'IDENTITY_PROVIDER_NOT_CONFIGURED',
      error: 'Identity provider is not configured'
    });
  }

  try {
    const identity = await resolveRequestIdentity(req);
    return res.status(200).json({
      ok: true,
      version: '2.3',
      authenticated: true,
      subject: identity.subject,
      provider: identity.provider
    });
  } catch (error) {
    return res.status(error.statusCode || 503).json({
      ok: false,
      version: '2.3',
      code: error.code || 'IDENTITY_ERROR',
      error: error.message || 'Identity verification failed'
    });
  }
};
