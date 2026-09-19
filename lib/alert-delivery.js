// MVP 2.3 — external notification delivery boundary.
// A configured provider receives one already-validated alert event.
// No provider means delivery is explicitly unavailable.

function createHttpAlertDelivery({ baseUrl, token } = {}) {
  const parsed = new URL(baseUrl);
  if (parsed.protocol !== 'https:') {
    const error = new Error('Alert delivery provider must use HTTPS');
    error.code = 'PROVIDER_INVALID';
    error.statusCode = 503;
    throw error;
  }

  return {
    provider: 'HTTPS JSON alert delivery',
    configured: true,
    async send(alert) {
      const response = await fetch(new URL('/deliver', parsed), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ alert })
      });

      if (!response.ok) {
        const error = new Error(`Alert delivery provider returned HTTP ${response.status}`);
        error.code = 'DELIVERY_PROVIDER_ERROR';
        error.statusCode = 502;
        throw error;
      }

      let data = {};
      try { data = await response.json(); } catch (_) {}
      return data;
    }
  };
}

function getConfiguredAlertDelivery() {
  const url = process.env.RADAR_ALERT_DELIVERY_URL;
  if (!url) return null;
  try {
    return createHttpAlertDelivery({
      baseUrl: url,
      token: process.env.RADAR_ALERT_DELIVERY_TOKEN || ''
    });
  } catch (_) {
    return null;
  }
}

function getAlertDeliveryStatus() {
  const configured = Boolean(getConfiguredAlertDelivery());
  return {
    configured,
    provider: 'HTTPS JSON alert delivery',
    delivery: configured ? 'provider-backed' : 'not-configured'
  };
}

module.exports = {
  createHttpAlertDelivery,
  getConfiguredAlertDelivery,
  getAlertDeliveryStatus
};
