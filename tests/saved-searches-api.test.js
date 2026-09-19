const assert = require('node:assert/strict');
const handler = require('../api/saved-searches');

function mockResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
}

(async () => {
  const reqGet = {
    method: 'GET',
    headers: { 'x-radar-user-id': 'test_device_1' },
    query: {}
  };
  const resGet = mockResponse();
  await handler(reqGet, resGet);
  assert.equal(resGet.statusCode, 200);
  assert.equal(resGet.body.version, '2.1');
  assert.equal(Array.isArray(resGet.body.searches), true);
  assert.equal(resGet.body.durable, false);

  const reqPost = {
    method: 'POST',
    headers: { 'x-radar-user-id': 'test_device_1' },
    query: {},
    body: {
      search: {
        name: 'Remote evaluator',
        query: 'AI',
        type: 'Evaluator',
        mode: 'Remote',
        location: 'Philippines'
      }
    }
  };
  const resPost = mockResponse();
  await handler(reqPost, resPost);
  assert.equal(resPost.statusCode, 200);
  assert.equal(resPost.body.searches.length, 1);

  const reqDelete = {
    method: 'DELETE',
    headers: { 'x-radar-user-id': 'test_device_1' },
    query: {},
    body: { name: 'Remote evaluator' }
  };
  const resDelete = mockResponse();
  await handler(reqDelete, resDelete);
  assert.equal(resDelete.statusCode, 200);
  assert.equal(resDelete.body.searches.length, 0);

  const badReq = { method: 'GET', headers: {}, query: {} };
  const badRes = mockResponse();
  await handler(badReq, badRes);
  assert.equal(badRes.statusCode, 400);
  assert.equal(badRes.body.code, 'OWNER_ID_INVALID');

  console.log('saved-searches-api.test.js: PASS');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
