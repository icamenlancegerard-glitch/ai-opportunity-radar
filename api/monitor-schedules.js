const {
  MAX_SCHEDULES,
  validateScheduleInput
} = require('../lib/monitor-schedules');
const {
  getMonitorScheduleStore,
  getMonitorScheduleStorageStatus
} = require('../lib/monitor-schedule-store');
const { normalizeOwnerId } = require('../lib/saved-search-store');
const { resolveRequestIdentity } = require('../lib/request-identity');

// MVP 3.1 — authenticated user-owned monitoring schedules.

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body); } catch (_) { return {}; }
}

function errorResponse(res, status, message, code = 'MONITOR_SCHEDULE_ERROR') {
  return res.status(status).json({
    ok: false,
    version: '3.1',
    error: message,
    code
  });
}

function getInput(body) {
  return body && body.schedule && typeof body.schedule === 'object'
    ? body.schedule
    : (body || {});
}

module.exports = async (req, res) => {
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method)) {
    return errorResponse(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED');
  }

  let ownerId;
  try {
    const identity = await resolveRequestIdentity(req);
    ownerId = normalizeOwnerId(identity.subject);
  } catch (error) {
    return errorResponse(res, error.statusCode || 503, error.message, error.code);
  }

  const store = getMonitorScheduleStore();
  const storage = getMonitorScheduleStorageStatus();
  const body = parseBody(req);

  const requestedOwnerId = typeof body.ownerId === 'string' ? body.ownerId.trim() : '';
  if (requestedOwnerId && requestedOwnerId !== ownerId) {
    return errorResponse(res, 403, 'Client-supplied owner id does not match authenticated identity', 'OWNER_ID_MISMATCH');
  }

  try {
    if (req.method === 'GET') {
      const schedules = await store.list(ownerId);
      return res.status(200).json({
        ok: true,
        version: '3.1',
        ownerId,
        storage: storage.storage,
        durable: storage.durable,
        count: schedules.length,
        maxSchedules: MAX_SCHEDULES,
        schedules
      });
    }

    if (req.method === 'POST') {
      const schedule = validateScheduleInput(getInput(body));
      const created = await store.create(ownerId, schedule);
      const schedules = await store.list(ownerId);
      return res.status(201).json({
        ok: true,
        version: '3.1',
        ownerId,
        storage: storage.storage,
        durable: storage.durable,
        schedule: created,
        schedules
      });
    }

    const scheduleId =
      typeof body.id === 'string'
        ? body.id.trim()
        : typeof req.query?.id === 'string'
          ? req.query.id.trim()
          : '';

    if (!scheduleId) return errorResponse(res, 400, 'Schedule id is required', 'SCHEDULE_ID_REQUIRED');

    if (req.method === 'PATCH') {
      const updated = await store.update(ownerId, scheduleId, getInput(body));
      if (!updated) return errorResponse(res, 404, 'Schedule not found', 'SCHEDULE_NOT_FOUND');
      return res.status(200).json({
        ok: true,
        version: '3.1',
        ownerId,
        storage: storage.storage,
        durable: storage.durable,
        schedule: updated
      });
    }

    const removed = await store.remove(ownerId, scheduleId);
    if (!removed) return errorResponse(res, 404, 'Schedule not found', 'SCHEDULE_NOT_FOUND');

    return res.status(200).json({
      ok: true,
      version: '3.1',
      ownerId,
      storage: storage.storage,
      durable: storage.durable,
      removed: true,
      scheduleId
    });
  } catch (error) {
    return errorResponse(
      res,
      error?.statusCode || 500,
      error instanceof Error ? error.message : 'Monitoring schedule operation failed',
      error?.code || 'MONITOR_SCHEDULE_ERROR'
    );
  }
};
