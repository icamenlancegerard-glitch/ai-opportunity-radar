const assert = require('node:assert/strict');
const handler = require('../api/monitor');

function mockResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
}

(async () => {
  const oldSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'test-cron-secret';

  const unauthorized = mockResponse();
  await handler({
    method: 'GET',
    headers: { authorization: 'Bearer wrong-secret' }
  }, unauthorized);
  assert.equal(unauthorized.statusCode, 401);
  assert.equal(unauthorized.body.code, 'CRON_UNAUTHORIZED');

  const forbiddenWithoutSecret = mockResponse();
  delete process.env.CRON_SECRET;
  await handler({
    method: 'GET',
    headers: { authorization: 'Bearer test-cron-secret' }
  }, forbiddenWithoutSecret);
  assert.equal(forbiddenWithoutSecret.statusCode, 401);

  process.env.CRON_SECRET = oldSecret === undefined ? 'test-cron-secret' : oldSecret;
  console.log('monitor.test.js: PASS');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
