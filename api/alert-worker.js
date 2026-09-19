const { getAlertOutbox, getAlertOutboxStatus } = require('../lib/alert-outbox');
const { getConfiguredAlertDelivery, getAlertDeliveryStatus } = require('../lib/alert-delivery');
const { isAuthorizedCron } = require('../lib/cron-auth');

// MVP 2.5 — protected alert delivery worker.
// It claims eligible outbox events, attempts external delivery, and records
// delivered/retry/failed lifecycle state. No delivery is claimed without a provider.

const DEFAULT_MAX_EVENTS = 25;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_LEASE_MS = 5 * 60 * 1000;
const DEFAULT_BACKOFF_MS = 60 * 1000;

function parsePositiveInt(value, fallback, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function backoffMs(attempts, baseMs = DEFAULT_BACKOFF_MS) {
  const exponent = Math.max(0, attempts - 1);
  return Math.min(baseMs * (2 ** exponent), 60 * 60 * 1000);
}

async function runAlertDeliveryCycle({
  outbox = getAlertOutbox(),
  delivery = getConfiguredAlertDelivery(),
  now = new Date(),
  maxEvents = DEFAULT_MAX_EVENTS,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  leaseMs = DEFAULT_LEASE_MS,
  backoffBaseMs = DEFAULT_BACKOFF_MS
} = {}) {
  if (!delivery) {
    return {
      ok: false,
      code: 'DELIVERY_NOT_CONFIGURED',
      inspected: 0,
      claimed: 0,
      delivered: 0,
      retried: 0,
      failed: 0,
      skipped: 0,
      results: []
    };
  }

  const events = await outbox.list({ statuses: ['queued', 'retry', 'delivering'], now });
  const candidates = events.slice(0, maxEvents);
  const results = [];
  let claimed = 0;
  let delivered = 0;
  let retried = 0;
  let failed = 0;
  let skipped = 0;

  for (const event of candidates) {
    const leaseUntil = new Date(now.getTime() + leaseMs).toISOString();
    const claimedEvent = await outbox.claim(event.eventKey, { leaseUntil, now });

    if (!claimedEvent) {
      skipped += 1;
      results.push({ eventKey: event.eventKey, status: 'skipped' });
      continue;
    }

    claimed += 1;

    try {
      const response = await delivery.send(claimedEvent);
      const completed = await outbox.markDelivered(claimedEvent.eventKey, { now });
      delivered += 1;
      results.push({
        eventKey: claimedEvent.eventKey,
        status: 'delivered',
        attempts: claimedEvent.attempts,
        providerResponse: response,
        event: completed
      });
    } catch (error) {
      const attempts = claimedEvent.attempts;
      const terminal = attempts >= maxAttempts;
      const nextAttemptAt = terminal
        ? null
        : new Date(now.getTime() + backoffMs(attempts, backoffBaseMs)).toISOString();

      const failedEvent = await outbox.markFailed(claimedEvent.eventKey, {
        error: error instanceof Error ? error.message : 'delivery failed',
        nextAttemptAt,
        maxAttempts
      });

      if (terminal) failed += 1;
      else retried += 1;

      results.push({
        eventKey: claimedEvent.eventKey,
        status: terminal ? 'failed' : 'retry',
        attempts,
        nextAttemptAt,
        error: error instanceof Error ? error.message : 'delivery failed',
        event: failedEvent
      });
    }
  }

  return {
    ok: true,
    code: 'DELIVERY_CYCLE_COMPLETE',
    inspected: candidates.length,
    claimed,
    delivered,
    retried,
    failed,
    skipped,
    results,
    outboxStorage: outbox.storage || 'unknown',
    outboxDurable: outbox.durable === true
  };
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'GET only' });
  if (!isAuthorizedCron(req)) {
    return res.status(401).json({
      ok: false,
      version: '2.5',
      error: 'Unauthorized cron request',
      code: 'CRON_UNAUTHORIZED'
    });
  }

  const outbox = getAlertOutbox();
  const delivery = getConfiguredAlertDelivery();

  if (!delivery) {
    return res.status(503).json({
      ok: false,
      version: '2.5',
      code: 'DELIVERY_NOT_CONFIGURED',
      alertOutbox: getAlertOutboxStatus(),
      alertDelivery: getAlertDeliveryStatus(),
      note: 'No external delivery provider is configured; no notification was attempted.'
    });
  }

  const report = await runAlertDeliveryCycle({
    outbox,
    delivery,
    maxEvents: parsePositiveInt(process.env.RADAR_ALERT_WORKER_MAX_EVENTS, DEFAULT_MAX_EVENTS, 100),
    maxAttempts: parsePositiveInt(process.env.RADAR_ALERT_WORKER_MAX_ATTEMPTS, DEFAULT_MAX_ATTEMPTS, 10)
  });

  return res.status(200).json({
    ok: report.ok,
    version: '2.5',
    ...report,
    alertOutbox: getAlertOutboxStatus(),
    alertDelivery: getAlertDeliveryStatus(),
    note: 'Delivery is attempted only for claimed outbox events. Failed events retry with bounded backoff until max attempts, then become terminal failed.'
  });
};

module.exports.runAlertDeliveryCycle = runAlertDeliveryCycle;
module.exports.backoffMs = backoffMs;
