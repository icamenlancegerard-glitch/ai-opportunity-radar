const assert = require('node:assert/strict');
const {
  createHttpAlertDelivery,
  getAlertDeliveryStatus
} = require('../lib/alert-delivery');

assert.equal(getAlertDeliveryStatus().configured, false);
assert.throws(
  () => createHttpAlertDelivery({ baseUrl: 'http://delivery.example.test' }),
  /must use HTTPS/
);

(async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    assert.equal(String(url), 'https://delivery.example.test/deliver');
    assert.equal(options.method, 'POST');
    assert.match(options.headers.Authorization, /^Bearer /);
    return { ok: true, status: 202, json: async () => ({ accepted: true }) };
  };

  const delivery = createHttpAlertDelivery({
    baseUrl: 'https://delivery.example.test',
    token: 'delivery-token'
  });
  const result = await delivery.send({
    code: 'SOURCE_DOWN',
    url: 'https://ph.indeed.com/viewjob?jk=1',
    checkedAt: '2026-09-19T00:00:00.000Z'
  });
  assert.equal(result.accepted, true);

  global.fetch = originalFetch;
  console.log('alert-delivery.test.js: PASS');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
