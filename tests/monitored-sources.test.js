const assert = require('node:assert/strict');
const {
  normalizeSource,
  MONITORED_SOURCE_REGISTRY,
  MONITORED_SOURCES,
  getMonitoredSources,
  getMonitoredSourceStatus
} = require('../lib/monitored-sources');

assert.equal(MONITORED_SOURCE_REGISTRY.length, 5);
assert.equal(MONITORED_SOURCES.length, 5);
assert.equal(getMonitoredSources().every(source => source.state === 'active'), true);
assert.equal(getMonitoredSources({ includeInactive: true }).length, 5);

const status = getMonitoredSourceStatus();
assert.equal(status.registrySize, 5);
assert.equal(status.active, 5);
assert.equal(status.paused, 0);
assert.equal(status.retired, 0);
assert.equal(status.uniqueIds, true);
assert.equal(status.uniqueUrls, true);

const normalized = normalizeSource({
  id: 'source-01',
  name: 'Example',
  url: 'https://ph.indeed.com/viewjob?z=2&jk=abc&a=1#details',
  state: 'active'
});
assert.equal(normalized.url, 'https://ph.indeed.com/viewjob?a=1&jk=abc&z=2');

assert.throws(
  () => normalizeSource({ id: 'Bad ID', name: 'Bad', url: 'https://ph.indeed.com/viewjob?jk=x', state: 'active' }),
  /id must be lowercase/
);
assert.throws(
  () => normalizeSource({ id: 'good-id', name: 'Bad', url: 'https://ph.indeed.com/viewjob?jk=x', state: 'disabled' }),
  /state is invalid/
);
assert.throws(
  () => normalizeSource({ id: 'good-id', name: 'Bad', url: 'https://example.com/job', state: 'active' }),
  /allowlisted/
);

console.log('monitored-sources.test.js: PASS');
