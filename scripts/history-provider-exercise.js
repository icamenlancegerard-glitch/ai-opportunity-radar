// AI Opportunity Radar MVP 3.5 — Supabase-only durable history exercise.
// Writes one synthetic test record and reads it back.
// No email is sent and no alert delivery is attempted.
const assert = require('node:assert/strict');
const { getHistoryStore, getHistoryStorageStatus } = require('../lib/history-store');

function requireConfig() {
  const missing = ['RADAR_SUPABASE_URL'].filter((key) => !process.env[key]);
  const hasSecretKey = Boolean(process.env.RADAR_SUPABASE_SECRET_KEY);
  const hasLegacyKey = Boolean(process.env.RADAR_SUPABASE_SERVICE_ROLE_KEY);

  if (missing.length || (!hasSecretKey && !hasLegacyKey)) {
    const details = missing.concat(!hasSecretKey && !hasLegacyKey ? ['RADAR_SUPABASE_SECRET_KEY (or legacy RADAR_SUPABASE_SERVICE_ROLE_KEY)'] : []);
    throw new Error('Missing Supabase configuration: ' + details.join(', '));
  }

  if (process.env.RADAR_HISTORY_EXERCISE_CONFIRM !== 'YES') {
    throw new Error(
      'Set RADAR_HISTORY_EXERCISE_CONFIRM=YES to run the real Supabase history exercise. ' +
      'This writes one synthetic test record.'
    );
  }
}

function makeTestRecord(sourceUrl, checkedAt) {
  return {
    schemaVersion: '1.3',
    snapshot: {
      url: sourceUrl,
      reachable: true,
      status: 200,
      checkedAt,
      availabilityEvidence: { status: 'NOT_VERIFIED', matchedSignals: [] },
      eligibilityEvidence: { status: 'NOT_VERIFIED', matchedSignals: [] },
      compensationEvidence: { status: 'NOT_VERIFIED', matchedSignals: [] }
    },
    previous: null,
    changed: false,
    changes: []
  };
}

(async () => {
  requireConfig();

  const status = getHistoryStorageStatus();
  assert.equal(status.storage, 'supabase-postgres');
  assert.equal(status.durable, true);

  const store = getHistoryStore();
  const checkedAt = new Date().toISOString();
  const sourceUrl =
    'https://ph.indeed.com/viewjob?jk=radar-history-exercise-' +
    checkedAt.replace(/[^0-9]/g, '');

  const record = makeTestRecord(sourceUrl, checkedAt);
  await store.append(record);

  const latest = await store.getLatest(sourceUrl);
  assert.ok(latest);
  assert.equal(latest.snapshot.url, sourceUrl);
  assert.equal(latest.snapshot.checkedAt, checkedAt);

  const records = await store.list(sourceUrl);
  assert.ok(records.length >= 1);
  assert.equal(records[records.length - 1].snapshot.checkedAt, checkedAt);

  console.log(JSON.stringify({
    ok: true,
    provider: status.storage,
    durable: status.durable,
    sourceUrl,
    recordsReadBack: records.length,
    verified: {
      write: true,
      readLatest: true,
      list: true
    }
  }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
