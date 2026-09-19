// MVP 1.7 — deterministic Philippines eligibility evidence.
// Only explicit applicant/location wording is accepted. A generic mention of
// "Philippines" or a Philippine office does not establish applicant eligibility.

const PH_OPEN = [
  'based in the philippines',
  'located in the philippines',
  'must be based in the philippines',
  'must be located in the philippines',
  'residents of the philippines',
  'residing in the philippines',
  'work from the philippines',
  'remote in the philippines',
  'remote within the philippines',
  'philippines only',
  'country: philippines',
  'location: philippines',
  'location - philippines',
  'philippines residents only'
];

const PH_CLOSED = [
  'not available in the philippines',
  'excluding the philippines',
  'philippines excluded',
  'not open to applicants in the philippines',
  'must be based in the united states',
  'must be located in the united states',
  'united states only',
  'us only',
  'u.s. only',
  'must reside in the united states',
  'residents of the united states only',
  'not available outside the united states'
];

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function classifyPhEligibility(rawUrl, bodyText, httpStatus) {
  let hostname = null;
  try { hostname = new URL(rawUrl).hostname; } catch {
    return { status: 'NOT_VERIFIED', source: 'unparseable_url', matchedSignals: [] };
  }

  if (!Number.isInteger(httpStatus) || httpStatus < 200 || httpStatus >= 400) {
    return { status: 'NOT_VERIFIED', source: 'non_success_http_response', matchedSignals: [] };
  }

  const text = normalizeText(bodyText);
  if (!text) return { status: 'NOT_VERIFIED', source: 'no_bounded_content', matchedSignals: [] };

  const open = PH_OPEN.filter(signal => text.includes(signal));
  const closed = PH_CLOSED.filter(signal => text.includes(signal));

  if (open.length && closed.length) {
    return {
      status: 'CONFLICTING_EVIDENCE',
      source: 'explicit_applicant_location_text',
      matchedSignals: [...new Set(
        open.map(signal => 'PH_ELIGIBLE:' + signal)
          .concat(closed.map(signal => 'PH_EXCLUDED:' + signal))
      )]
    };
  }

  if (open.length) {
    return {
      status: 'PH_ELIGIBLE_EVIDENCE',
      source: 'explicit_applicant_location_text',
      matchedSignals: [...new Set(open.map(signal => 'PH_ELIGIBLE:' + signal))]
    };
  }

  if (closed.length) {
    return {
      status: 'PH_EXCLUDED_EVIDENCE',
      source: 'explicit_applicant_location_text',
      matchedSignals: [...new Set(closed.map(signal => 'PH_EXCLUDED:' + signal))]
    };
  }

  return {
    status: 'NOT_VERIFIED',
    source: hostname ? 'no_explicit_ph_eligibility_signal' : 'unsupported_source',
    matchedSignals: []
  };
}

module.exports = { PH_OPEN, PH_CLOSED, normalizeText, classifyPhEligibility };
