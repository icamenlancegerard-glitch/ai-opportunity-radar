// MVP 3.1 — authenticated per-user monitoring schedule persistence.
// Uses the existing Supabase REST boundary when configured.
// Memory mode is retained only as an explicit local/test fallback.

const {
  MAX_SCHEDULES,
  normalizeSchedule,
  validateScheduleInput
} = require('./monitor-schedules');
const { normalizeOwnerId } = require('./saved-search-store');

function createMemoryMonitorScheduleStore() {
  const records = new Map();

  return {
    storage: 'memory-only',
    durable: false,

    async list(ownerId) {
      const key = normalizeOwnerId(ownerId);
      return (records.get(key) || []).map(item => ({ ...item }));
    },

    async create(ownerId, input) {
      const key = normalizeOwnerId(ownerId);
      const current = records.get(key) || [];
      if (current.length >= MAX_SCHEDULES) {
        const error = new Error('Maximum monitoring schedules reached');
        error.code = 'SCHEDULE_LIMIT_REACHED';
        error.statusCode = 409;
        throw error;
      }
      const schedule = validateScheduleInput(input);
      records.set(key, [...current, schedule]);
      return { ...schedule };
    },

    async update(ownerId, scheduleId, input) {
      const key = normalizeOwnerId(ownerId);
      const current = records.get(key) || [];
      const index = current.findIndex(item => item.id === scheduleId);
      if (index === -1) return null;

      const existing = current[index];
      const updated = normalizeSchedule({
        ...existing,
        ...(input && typeof input === 'object' ? input : {}),
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString()
      });

      const next = [...current];
      next[index] = updated;
      records.set(key, next);
      return { ...updated };
    },

    async remove(ownerId, scheduleId) {
      const key = normalizeOwnerId(ownerId);
      const current = records.get(key) || [];
      const next = current.filter(item => item.id !== scheduleId);
      if (next.length === current.length) return false;
      records.set(key, next);
      return true;
    },

    async listDue(now = new Date()) {
      const due = [];
      for (const [ownerId, schedules] of records.entries()) {
        for (const schedule of schedules) {
          const { isDue } = require('./monitor-schedules');
          if (isDue(schedule, { now })) due.push({ ...schedule, ownerId });
        }
      }
      return due.sort((a, b) => Date.parse(a.nextRunAt) - Date.parse(b.nextRunAt));
    },

    async claim(scheduleId, { leaseUntil, now = new Date() } = {}) {
      for (const [ownerId, schedules] of records.entries()) {
        const index = schedules.findIndex(item => item.id === scheduleId);
        if (index === -1) continue;

        const current = schedules[index];
        const { isDue } = require('./monitor-schedules');
        if (!isDue(current, { now })) return null;

        const claimed = {
          ...current,
          ownerId,
          leaseUntil: leaseUntil || new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
          updatedAt: now.toISOString()
        };
        const next = [...schedules];
        next[index] = claimed;
        records.set(ownerId, next);
        return { ...claimed };
      }
      return null;
    },

    async markComplete(scheduleId, { nextRunAt, lastRunAt, now = new Date() } = {}) {
      for (const [ownerId, schedules] of records.entries()) {
        const index = schedules.findIndex(item => item.id === scheduleId);
        if (index === -1) continue;

        const updated = {
          ...schedules[index],
          nextRunAt,
          lastRunAt: lastRunAt || now.toISOString(),
          leaseUntil: null,
          updatedAt: now.toISOString()
        };
        const next = [...schedules];
        next[index] = updated;
        records.set(ownerId, next);
        return { ...updated };
      }
      return null;
    },

    async release(scheduleId, { now = new Date() } = {}) {
      for (const [ownerId, schedules] of records.entries()) {
        const index = schedules.findIndex(item => item.id === scheduleId);
        if (index === -1) continue;

        const updated = {
          ...schedules[index],
          leaseUntil: null,
          updatedAt: now.toISOString()
        };
        const next = [...schedules];
        next[index] = updated;
        records.set(ownerId, next);
        return { ...updated };
      }
      return null;
    }
  };
}

function createSupabaseMonitorScheduleStore({ client }) {
  function rowToSchedule(row) {
    if (!row || typeof row !== 'object') return null;
    const schedule = normalizeSchedule({
      id: row.id,
      name: row.name,
      enabled: row.enabled,
      cadenceDays: row.cadence_days,
      sourceIds: Array.isArray(row.source_ids) ? row.source_ids : [],
      nextRunAt: row.next_run_at,
      lastRunAt: row.last_run_at,
      leaseUntil: row.lease_until,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
    if (typeof row.owner_id === 'string' && row.owner_id.trim()) {
      schedule.ownerId = row.owner_id.trim();
    }
    return schedule;
  }

  function ownerQuery(ownerId) {
    return '?owner_id=eq.' + encodeURIComponent(ownerId);
  }

  return {
    storage: 'supabase-postgres',
    durable: true,

    async list(ownerId) {
      const key = normalizeOwnerId(ownerId);
      const rows = await client.request(
        '/radar_monitor_schedules' + ownerQuery(key) + '&order=next_run_at.asc',
        { method: 'GET' }
      );
      return (Array.isArray(rows) ? rows : []).map(rowToSchedule).filter(Boolean);
    },

    async create(ownerId, input) {
      const key = normalizeOwnerId(ownerId);
      const schedule = validateScheduleInput(input);
      const rows = await client.request('/radar_monitor_schedules', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          id: schedule.id,
          owner_id: key,
          name: schedule.name,
          enabled: schedule.enabled,
          cadence_days: schedule.cadenceDays,
          source_ids: schedule.sourceIds,
          next_run_at: schedule.nextRunAt,
          last_run_at: schedule.lastRunAt,
          lease_until: schedule.leaseUntil,
          created_at: schedule.createdAt,
          updated_at: schedule.updatedAt
        })
      });
      return rowToSchedule(Array.isArray(rows) ? rows[0] : null) || schedule;
    },

    async update(ownerId, scheduleId, input) {
      const key = normalizeOwnerId(ownerId);
      const current = await this.list(key);
      const existing = current.find(item => item.id === scheduleId);
      if (!existing) return null;

      const updated = normalizeSchedule({
        ...existing,
        ...(input && typeof input === 'object' ? input : {}),
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString()
      });

      const rows = await client.request(
        '/radar_monitor_schedules?id=eq.' + encodeURIComponent(scheduleId) +
        '&owner_id=eq.' + encodeURIComponent(key),
        {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({
            name: updated.name,
            enabled: updated.enabled,
            cadence_days: updated.cadenceDays,
            source_ids: updated.sourceIds,
            next_run_at: updated.nextRunAt,
            last_run_at: updated.lastRunAt,
            lease_until: updated.leaseUntil,
            updated_at: updated.updatedAt
          })
        }
      );
      return rowToSchedule(Array.isArray(rows) ? rows[0] : null) || updated;
    },

    async remove(ownerId, scheduleId) {
      const key = normalizeOwnerId(ownerId);
      const rows = await client.request(
        '/radar_monitor_schedules?id=eq.' + encodeURIComponent(scheduleId) +
        '&owner_id=eq.' + encodeURIComponent(key),
        { method: 'DELETE', headers: { Prefer: 'return=representation' } }
      );
      return Array.isArray(rows) && rows.length > 0;
    },

    async listDue(now = new Date()) {
      const timestamp = encodeURIComponent(now.toISOString());
      const rows = await client.request(
        '/radar_monitor_schedules?enabled=eq.true&next_run_at=lte.' + timestamp +
        '&or=(lease_until.is.null,lease_until.lte.' + timestamp + ')&order=next_run_at.asc',
        { method: 'GET' }
      );
      return (Array.isArray(rows) ? rows : []).map(rowToSchedule).filter(Boolean);
    },

    async claim(scheduleId, { leaseUntil, now = new Date() } = {}) {
      const rows = await client.request(
        '/rpc/radar_claim_monitor_schedule',
        {
          method: 'POST',
          body: JSON.stringify({
            p_schedule_id: scheduleId,
            p_lease_until: leaseUntil || new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
            p_now: now.toISOString()
          })
        }
      );
      return rowToSchedule(Array.isArray(rows) ? rows[0] : null);
    },

    async markComplete(scheduleId, { nextRunAt, lastRunAt, now = new Date() } = {}) {
      const rows = await client.request(
        '/rpc/radar_mark_monitor_schedule_complete',
        {
          method: 'POST',
          body: JSON.stringify({
            p_schedule_id: scheduleId,
            p_next_run_at: nextRunAt,
            p_last_run_at: lastRunAt || now.toISOString(),
            p_now: now.toISOString()
          })
        }
      );
      return rowToSchedule(Array.isArray(rows) ? rows[0] : null);
    },

    async release(scheduleId, { now = new Date() } = {}) {
      const rows = await client.request(
        '/rpc/radar_release_monitor_schedule',
        {
          method: 'POST',
          body: JSON.stringify({
            p_schedule_id: scheduleId,
            p_now: now.toISOString()
          })
        }
      );
      return rowToSchedule(Array.isArray(rows) ? rows[0] : null);
    }
  };
}

function getConfiguredMonitorScheduleStore() {
  const supabase = require('./supabase-rest').getConfiguredSupabaseClient();
  if (!supabase) return null;
  return createSupabaseMonitorScheduleStore({ client: supabase });
}

const defaultMemoryStore = createMemoryMonitorScheduleStore();

function getMonitorScheduleStore() {
  return getConfiguredMonitorScheduleStore() || defaultMemoryStore;
}

function getMonitorScheduleStorageStatus() {
  const configured = getConfiguredMonitorScheduleStore();
  return {
    storage: configured ? configured.storage : defaultMemoryStore.storage,
    durable: configured ? configured.durable : defaultMemoryStore.durable,
    configured: Boolean(configured),
    provider: 'Supabase Postgres monitor schedule provider'
  };
}

module.exports = {
  createMemoryMonitorScheduleStore,
  createSupabaseMonitorScheduleStore,
  getMonitorScheduleStore,
  getMonitorScheduleStorageStatus
};
