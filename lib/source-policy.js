// MVP 1.5 — shared source policy and canonicalization.
// One security boundary for every source-recheck path.

const ALLOWED_HOSTS = new Set([
  'ph.indeed.com',
  'ph.jobstreet.com',
  'ph.linkedin.com',
  'jobs.telusdigital.com',
  'careers-mci2.icims.com'
]);

function policyError(message, statusCode) {
  const error = new Error(message);
  error.code = 'SOURCE_POLICY_REJECTED';
  error.statusCode = statusCode;
  return error;
}

function validateSourceUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    throw policyError('Missing url', 400);
  }

  let target;
  try {
    target = new URL(rawUrl);
  } catch {
    throw policyError('Invalid url', 400);
  }

  if (target.protocol !== 'https:') {
    throw policyError('Only HTTPS URLs are allowed', 400);
  }

  if (target.username || target.password) {
    throw policyError('Credentials in source URLs are not allowed', 400);
  }

  if (!ALLOWED_HOSTS.has(target.hostname)) {
    throw policyError('Source host is not allowlisted', 403);
  }

  // Canonicalization removes client-only fragments, normalizes host casing,
  // drops default HTTPS port, and makes query-key ordering deterministic.
  target.hash = '';
  target.hostname = target.hostname.toLowerCase();
  if (target.port === '443') target.port = '';
  target.searchParams.sort();
  return target;
}

function canonicalizeSourceUrl(rawUrl) {
  return validateSourceUrl(rawUrl).toString();
}

function getSourcePolicyStatus() {
  return {
    httpsOnly: true,
    credentialsBlocked: true,
    allowlistSize: ALLOWED_HOSTS.size,
    allowedHosts: Array.from(ALLOWED_HOSTS).sort()
  };
}

module.exports = {
  ALLOWED_HOSTS,
  validateSourceUrl,
  canonicalizeSourceUrl,
  getSourcePolicyStatus
};
