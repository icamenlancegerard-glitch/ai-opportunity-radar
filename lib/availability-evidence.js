// MVP 1.6 — deterministic availability evidence from bounded source text.
// Reports explicit page-language signals only.

const RULES = {
  'ph.indeed.com': {
    open: ['apply now', 'easily apply', 'accepting applications', 'now hiring', 'job is open'],
    closed: ['no longer accepting applications', 'applications are closed', 'this job is no longer available', 'job has been closed', 'position has been filled']
  },
  'ph.jobstreet.com': {
    open: ['apply now', 'active job', 'accepting applications', 'be among the first', 'apply'],
    closed: ['applications closed', 'no longer accepting applications', 'this job is no longer available', 'job closed', 'position has been filled']
  },
  'ph.linkedin.com': {
    open: ['apply', 'easy apply', 'be among the first 25 applicants', 'actively recruiting'],
    closed: ['no longer accepting applications', 'no longer accepting', 'job is no longer available', 'this job is closed']
  },
  'jobs.telusdigital.com': {
    open: ['apply now', 'apply for this job', 'submit application', 'we are hiring'],
    closed: ['position is closed', 'no longer accepting applications', 'job is no longer available', 'position has been filled']
  },
  'careers-mci2.icims.com': {
    open: ['apply for this job', 'apply now', 'submit application', 'currently accepting applications'],
    closed: ['job is no longer available', 'position is no longer available', 'applications are closed', 'position has been filled']
  }
};

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return decodeEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function classifyAvailability(rawUrl, bodyText) {
  let hostname = null;
  try { hostname = new URL(rawUrl).hostname; }
  catch { return { status: 'NOT_VERIFIED', source: 'unparseable_url', matchedSignals: [] }; }

  const normalized = normalizeText(bodyText);
  if (!normalized) return { status: 'NOT_VERIFIED', source: 'no_bounded_content', matchedSignals: [] };

  const rule = RULES[hostname];
  if (!rule) return { status: 'NOT_VERIFIED', source: 'unsupported_source', matchedSignals: [] };

  const open = rule.open.filter(signal => normalized.includes(signal));
  const closed = rule.closed.filter(signal => normalized.includes(signal));
  const matched = open.map(signal => 'OPEN:' + signal).concat(closed.map(signal => 'CLOSED:' + signal));

  if (open.length && closed.length) return {
    status: 'CONFLICTING_EVIDENCE',
    source: 'explicit_page_text',
    matchedSignals: [...new Set(matched)]
  };
  if (open.length) return {
    status: 'OPEN_EVIDENCE',
    source: 'explicit_page_text',
    matchedSignals: [...new Set(open.map(signal => 'OPEN:' + signal))]
  };
  if (closed.length) return {
    status: 'CLOSED_EVIDENCE',
    source: 'explicit_page_text',
    matchedSignals: [...new Set(closed.map(signal => 'CLOSED:' + signal))]
  };

  return { status: 'NOT_VERIFIED', source: 'no_explicit_availability_signal', matchedSignals: [] };
}

module.exports = { RULES, normalizeText, classifyAvailability };
