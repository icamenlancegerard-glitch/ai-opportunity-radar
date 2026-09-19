const assert = require('node:assert/strict');
const handler = require('../api/alerts-all');

function mockResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
}

(async () => {
  const res = mockResponse();
  await handler({ method: 'GET' }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.version, '2.2');
  assert.equal(Array.isArray(res.body.alerts), true);
  assert.equal(res.body.durable, false);
  assert.equal(res.body.monitoredSources, 5);

  const bad = mockResponse();
  await handler({ method: 'POST' }, bad);
  assert.equal(bad.statusCode, 405);

  console.log('alerts-all.test.js: PASS');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
