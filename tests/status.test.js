const assert = require('node:assert/strict');
const statusHandler = require('../api/status');

async function run() {
  let payload;
  let statusCode = null;
  const req = { method: 'GET' };
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(value) {
      payload = value;
      return this;
    }
  };

  await statusHandler(req, res);

  assert.equal(statusCode, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.version, '1.3');
  assert.equal(payload.runtime.historyEngine, true);
  assert.equal(payload.runtime.historyStore, true);
  assert.equal(payload.runtime.storage, 'memory-only');
  assert.equal(payload.runtime.durable, false);
  assert.equal(payload.verification.jobAvailability, 'not_verified');
  assert.equal(payload.verification.eligibility, 'not_verified');

  console.log('status.test.js: PASS');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
