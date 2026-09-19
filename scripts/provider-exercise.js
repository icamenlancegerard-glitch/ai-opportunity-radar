// AI Opportunity Radar MVP 2.8 — real provider exercise.
// This script intentionally sends one real test email and writes one real
// history/outbox record. Set RADAR_PROVIDER_EXERCISE_CONFIRM=YES first.
const assert = require('node:assert/strict');
const { getHistoryStore, getHistoryStorageStatus } = require('../lib/history-store');
const { getAlertOutbox, getAlertOutboxStatus } = require('../lib/alert-outbox');
const { getConfiguredAlertDelivery, getAlertDeliveryStatus } = require('../lib/alert-delivery');
const { runAlertDeliveryCycle } = require('../api/alert-worker');

function requireConfig() {
  const missing = [
    'RADAR_SUPABASE_URL',
    'RADAR_SUPABASE_SERVICE_ROLE_KEY',
    'RESEND_API_KEY',
    'RADAR_ALERT_FROM',
    'RADAR_ALERT_TO'
  ].filter(key => !process.env[key]);

  if (missing.length) throw new Error('Missing provider configuration: ' + missing.join(', '));
  if (process.env.RADAR_PROVIDER_EXERCISE_CONFIRM !== 'YES') {
    throw new Error('Set RADAR_PROVIDER_EXERCISE_CONFIRM=YES to run the real provider exercise. This will send one email.');
  }
}

(async () => {
  requireConfig();

  const history = getHistoryStorageStatus();
  const outbox = getAlertOutboxStatus();
  const delivery = getAlertDeliveryStatus();

  assert.equal(history.durable, true);
  assert.equal(outbox.durable, true);
  assert.equal(delivery.configured, true);

  const checkedAt = new Date().toISOString();
  const sourceUrl = 'https://ph.indeed.com/viewjob?jk=provider-exercise';
  const record = {
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

  const historyStore = getHistoryStore();
  await historyStore.append(record);
  const latest = await historyStore.getLatest(sourceUrl);
  assert.equal(latest.snapshot.checkedAt, checkedAt);

  const event = await getAlertOutbox().enqueue({
    code: 'PROVIDER_EXERCISE',
    severity: 'info',
    title: 'Provider exercise completed',
    url: sourceUrl,
    sourceUrl,
    checkedAt
  });

  const report = await runAlertDeliveryCycle({
    outbox: getAlertOutbox(),
    delivery: getConfiguredAlertDelivery(),
    maxEvents: 1,
    maxAttempts: 1
  });

  assert.equal(report.delivered, 1);
  console.log(JSON.stringify({
    ok: true,
    history,
    outbox,
    delivery,
    eventKey: event.eventKey,
    deliveryReport: {
      delivered: report.delivered,
      failed: report.failed,
      retried: report.retried
    }
  }, null, 2));
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
