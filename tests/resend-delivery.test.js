const assert = require('node:assert/strict');
const {
  createResendAlertDelivery,
  getAlertDeliveryStatus
} = require('../lib/alert-delivery');

assert.throws(
  () => createResendAlertDelivery({ apiKey: '', from: 'x', to: 'y' }),
  /requires API key/
);

(async () => {
  const originalFetch = global.fetch;
  let request = null;

  global.fetch = async (url, options) => {
    request = { url: String(url), options };
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: 'email_test_123' })
    };
  };

  const delivery = createResendAlertDelivery({
    apiKey: 're_test',
    from: 'onboarding@resend.dev',
    to: 'delivered@resend.dev'
  });

  const result = await delivery.send({
    code: 'AVAILABILITY_OPENED',
    severity: 'info',
    title: 'Open availability evidence detected',
    url: 'https://ph.indeed.com/viewjob?jk=test',
    checkedAt: '2026-09-19T00:00:00.000Z'
  });

  assert.equal(result.id, 'email_test_123');
  assert.equal(request.url, 'https://api.resend.com/emails');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers.Authorization, 'Bearer re_test');

  global.fetch = originalFetch;
  console.log('resend-delivery.test.js: PASS');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
