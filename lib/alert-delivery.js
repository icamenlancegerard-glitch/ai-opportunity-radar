// MVP 2.8 — external notification delivery boundary with optional direct Resend transport.
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

function createResendAlertDelivery({ apiKey, from, to } = {}) {
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';
  const sender = typeof from === 'string' ? from.trim() : '';
  const recipient = typeof to === 'string' ? to.trim() : '';
  if (!key || !sender || !recipient) {
    const error = new Error('Resend delivery requires API key, from, and to');
    error.code = 'PROVIDER_INVALID';
    error.statusCode = 503;
    throw error;
  }

  return {
    provider: 'Resend email delivery',
    configured: true,
    async send(alert) {
      const sourceUrl = alert.sourceUrl || alert.url;
      const subject = '[AI Opportunity Radar] ' + (alert.title || alert.code || 'Evidence change');
      const text = [
        'AI Opportunity Radar alert',
        '',
        'Event: ' + (alert.code || 'UNKNOWN'),
        'Severity: ' + (alert.severity || 'UNKNOWN'),
        'Title: ' + (alert.title || 'Evidence change'),
        'Source: ' + sourceUrl,
        'Checked at: ' + (alert.checkedAt || 'UNKNOWN'),
        '',
        'This notification reports a recorded evidence change. It does not claim hiring truth.'
      ].join('\n');

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + key
        },
        body: JSON.stringify({ from: sender, to: [recipient], subject, text })
      });

      let data = {};
      try { data = await response.json(); } catch (_) {}
      if (!response.ok) {
        const error = new Error(data?.message || 'Resend returned HTTP ' + response.status);
        error.code = 'RESEND_PROVIDER_ERROR';
        error.statusCode = 502;
        throw error;
      }
      return { provider: 'resend', ...data };
    }
  };
}

function getConfiguredAlertDelivery() {
  if (process.env.RESEND_API_KEY && process.env.RADAR_ALERT_FROM && process.env.RADAR_ALERT_TO) {
    try {
      return createResendAlertDelivery({
        apiKey: process.env.RESEND_API_KEY,
        from: process.env.RADAR_ALERT_FROM,
        to: process.env.RADAR_ALERT_TO
      });
    } catch (_) {}
  }

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
  createResendAlertDelivery,
  getConfiguredAlertDelivery,
  getAlertDeliveryStatus
};
