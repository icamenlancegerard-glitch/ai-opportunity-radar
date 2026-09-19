// MVP 1.8 — deterministic compensation evidence.
// Accepts explicit currency + amount/range + payment unit only.
// Marketing language or bare currency symbols are not compensation evidence.

const EXPLICIT_PAY_RE = /(?:(?:₱|PHP|USD|US\$|\$|EUR|€|GBP|£|CAD|AUD|SGD)\s*)?\d{1,3}(?:,\d{3})*(?:\.\d+)?(?:\s*(?:-|–|—|to)\s*(?:(?:₱|PHP|USD|US\$|\$|EUR|€|GBP|£|CAD|AUD|SGD)\s*)?\d{1,3}(?:,\d{3})*(?:\.\d+)?)?\s*(?:(?:₱|PHP|USD|US\$|\$|EUR|€|GBP|£|CAD|AUD|SGD)\s*)?(?:\/\s*(?:hr|hour|day|week|month|year|project|task)|per\s+(?:hour|hr|day|week|month|year|project|task)|(?:hourly|daily|weekly|monthly|yearly|annually))/gi;

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasCurrency(text) {
  return /₱|PHP|USD|US\$|\$|EUR|€|GBP|£|CAD|AUD|SGD/i.test(text);
}

function classifyCompensation(rawUrl, bodyText, httpStatus) {
  try { new URL(rawUrl); }
  catch { return { status: 'NOT_VERIFIED', source: 'unparseable_url', matchedSignals: [] }; }

  if (!Number.isInteger(httpStatus) || httpStatus < 200 || httpStatus >= 400) {
    return { status: 'NOT_VERIFIED', source: 'non_success_http_response', matchedSignals: [] };
  }

  const text = normalizeText(bodyText);
  if (!text) return { status: 'NOT_VERIFIED', source: 'no_bounded_content', matchedSignals: [] };

  const matches = [];
  EXPLICIT_PAY_RE.lastIndex = 0;
  let match;
  while ((match = EXPLICIT_PAY_RE.exec(text)) && matches.length < 10) {
    const raw = match[0].replace(/\s+/g, ' ').trim();
    if (hasCurrency(raw)) matches.push('PAY:' + raw);
  }
  EXPLICIT_PAY_RE.lastIndex = 0;

  return matches.length
    ? { status: 'COMPENSATION_EVIDENCE', source: 'explicit_compensation_text', matchedSignals: [...new Set(matches)] }
    : { status: 'NOT_VERIFIED', source: 'no_explicit_compensation_signal', matchedSignals: [] };
}

module.exports = { EXPLICIT_PAY_RE, normalizeText, classifyCompensation };
