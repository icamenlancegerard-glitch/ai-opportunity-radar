// MVP 2.6 — monitored-source lifecycle registry.
// Configuration is intentionally explicit: source identity is stable, URL is
// canonicalized, and lifecycle state controls whether scheduled monitoring runs.

const { canonicalizeSourceUrl } = require('./source-policy');

const RAW_SOURCES = [
  {
    id: 'indeed-ai-001',
    name: 'Indeed AI opportunity 001',
    url: 'https://ph.indeed.com/viewjob?jk=03a8507824d49250',
    state: 'active'
  },
  {
    id: 'indeed-ai-002',
    name: 'Indeed AI opportunity 002',
    url: 'https://ph.indeed.com/viewjob?jk=a7d4a2a28797af71',
    state: 'active'
  },
  {
    id: 'jobstreet-ai-001',
    name: 'JobStreet AI opportunity 001',
    url: 'https://ph.jobstreet.com/job/94200540',
    state: 'active'
  },
  {
    id: 'jobstreet-ai-002',
    name: 'JobStreet AI opportunity 002',
    url: 'https://ph.jobstreet.com/job/94235501',
    state: 'active'
  },
  {
    id: 'telus-ai-ph',
    name: 'TELUS Digital AI Philippines search',
    url: 'https://jobs.telusdigital.com/search/cfm5/customer-experience-cx/jobs/in/country/philippines?ns_category=artificial-intelligence',
    state: 'active'
  }
];

const VALID_STATES = new Set(['active', 'paused', 'retired']);

function normalizeSource(source) {
  if (!source || typeof source !== 'object') throw new Error('Monitored source is required');
  const id = typeof source.id === 'string' ? source.id.trim() : '';
  const name = typeof source.name === 'string' ? source.name.trim() : '';
  const state = typeof source.state === 'string' ? source.state.trim().toLowerCase() : '';

  if (!id) throw new Error('Monitored source id is required');
  if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(id)) {
    throw new Error('Monitored source id must be lowercase and URL-safe');
  }
  if (!name) throw new Error('Monitored source name is required');
  if (!VALID_STATES.has(state)) throw new Error('Monitored source state is invalid');

  return Object.freeze({
    id,
    name,
    url: canonicalizeSourceUrl(source.url),
    state
  });
}

function buildRegistry(rawSources) {
  const byId = new Set();
  const byUrl = new Set();
  const sources = rawSources.map(normalizeSource);

  for (const source of sources) {
    if (byId.has(source.id)) throw new Error(`Duplicate monitored source id: ${source.id}`);
    if (byUrl.has(source.url)) throw new Error(`Duplicate monitored source URL: ${source.url}`);
    byId.add(source.id);
    byUrl.add(source.url);
  }

  return Object.freeze(sources);
}

const MONITORED_SOURCE_REGISTRY = buildRegistry(RAW_SOURCES);
const MONITORED_SOURCES = Object.freeze(
  MONITORED_SOURCE_REGISTRY.filter(source => source.state === 'active').map(source => source.url)
);

function getMonitoredSources({ includeInactive = false } = {}) {
  return MONITORED_SOURCE_REGISTRY.filter(source => includeInactive || source.state === 'active');
}

function getMonitoredSourceStatus() {
  const counts = { active: 0, paused: 0, retired: 0 };
  for (const source of MONITORED_SOURCE_REGISTRY) counts[source.state] += 1;

  return {
    registrySize: MONITORED_SOURCE_REGISTRY.length,
    active: counts.active,
    paused: counts.paused,
    retired: counts.retired,
    uniqueIds: new Set(MONITORED_SOURCE_REGISTRY.map(source => source.id)).size === MONITORED_SOURCE_REGISTRY.length,
    uniqueUrls: new Set(MONITORED_SOURCE_REGISTRY.map(source => source.url)).size === MONITORED_SOURCE_REGISTRY.length
  };
}

module.exports = {
  VALID_STATES,
  normalizeSource,
  MONITORED_SOURCE_REGISTRY,
  MONITORED_SOURCES,
  getMonitoredSources,
  getMonitoredSourceStatus
};
