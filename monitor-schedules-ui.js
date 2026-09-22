// MVP 3.1 — user monitoring schedule controls.
// Uses the existing session-only bearer token established by the 3.0 subscription UI.
// No passwords are handled here.

(() => {
  const TOKEN_KEY = 'ai-radar-session-token-v1';
  const CADENCES = [1, 3, 7, 14, 30];

  function token() {
    try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch (_) { return ''; }
  }

  async function request(path, options = {}) {
    const bearer = token();
    return fetch(path, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(bearer ? { Authorization: 'Bearer ' + bearer } : {}),
        ...(options.headers || {})
      }
    });
  }

  function esc(value) {
    return String(value).replace(/[&<>'"]/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[c]));
  }

  function setState(message) {
    const el = document.getElementById('monitorScheduleState');
    if (el) el.textContent = message;
  }

  const MAX_REFRESH_URLS = 10;

  function freshnessPanelState(message) {
    const el = document.getElementById('freshnessControlState');
    if (el) el.textContent = message;
  }

  function visibleSourceUrls() {
    const urls = [...document.querySelectorAll('#grid a.source')]
      .map((link) => link.href)
      .filter(Boolean);
    return [...new Set(urls)].slice(0, MAX_REFRESH_URLS);
  }

  function renderRefreshResults(report) {
    const box = document.getElementById('freshnessControlResults');
    if (!box) return;

    if (!report || !Array.isArray(report.results)) {
      box.textContent = 'No refresh results returned.';
      return;
    }

    box.innerHTML = report.results.map((item) => {
      const changes = item.changes?.length ? ' · changes: ' + esc(item.changes.join(', ')) : '';
      const evidence =
        'Source: ' + esc(item.sourceStatus) +
        ' · Availability: ' + esc(item.availability) +
        ' · PH: ' + esc(item.eligibility) +
        ' · Pay: ' + esc(item.pay) +
        ' · Hiring: ' + esc(item.hiringStatus);

      return '<div class="evidence" style="margin-top:8px">' +
        '<strong>' + (item.reachable ? 'REACHABLE' : 'UNREACHABLE') + '</strong>' +
        ' · HTTP ' + esc(item.httpStatus ?? 'UNKNOWN') +
        '<br><small>' + evidence + changes +
        '<br>Checked: ' + esc(item.checkedAt) +
        '<br>' + esc(item.url) + '</small></div>';
    }).join('');

    if (report.blockedResults?.length) {
      box.innerHTML += report.blockedResults.map((item) =>
        '<div class="evidence" style="margin-top:8px"><strong>BLOCKED</strong> · ' +
        esc(item.code) + '<br><small>' + esc(item.url) +
        '<br>' + esc(item.error) + '</small></div>'
      ).join('');
    }
  }

  async function loadFreshnessStatus() {
    try {
      const response = await request('/api/status');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Runtime status load failed');

      const runtime = data.runtime || {};
      const history = runtime.storage || 'unknown';
      const identity = runtime.identity?.authentication || 'unknown';
      const outbox = runtime.alertOutbox?.durable ? 'durable' : 'non-durable';
      const delivery = runtime.alertDelivery?.configured ? 'provider-backed' : 'not-configured';
      const schedule = runtime.monitorScheduleStorage?.durable ? 'durable' : 'non-durable';
      const sources = Array.isArray(runtime.monitoredSources) ? runtime.monitoredSources.length : 0;

      const el = document.getElementById('freshnessInfrastructure');
      if (el) {
        el.innerHTML =
          '<strong>Infrastructure snapshot</strong><br><small>' +
          'History: ' + esc(history) +
          ' · Identity: ' + esc(identity) +
          ' · Outbox: ' + esc(outbox) +
          ' · Delivery: ' + esc(delivery) +
          ' · Schedules: ' + esc(schedule) +
          ' · Sources: ' + sources +
          '<br>Autonomous discovery: NOT CLAIMED · Batch recheck: enabled · Max batch: 10' +
          '</small>';
      }
    } catch (error) {
      freshnessPanelState('Infrastructure status unavailable: ' + error.message);
    }
  }

  async function refreshVisibleSources() {
    const urls = visibleSourceUrls();
    if (!urls.length) {
      freshnessPanelState('No visible source links to refresh.');
      return;
    }

    const button = document.getElementById('refreshVisibleSourcesBtn');
    if (button) {
      button.disabled = true;
      button.textContent = 'Refreshing…';
    }

    freshnessPanelState('SOURCE → RECHECK → EVIDENCE → STATUS…');

    try {
      const response = await request('/api/recheck-batch', {
        method: 'POST',
        body: JSON.stringify({ urls })
      });
      const report = await response.json();
      if (!response.ok) throw new Error(report.error || 'Batch refresh failed');

      renderRefreshResults(report);
      freshnessPanelState(
        'Batch complete · requested ' + report.requested +
        ' · refreshed ' + report.accepted +
        ' · blocked ' + report.blocked +
        ' · durable history: ' + (report.durable ? 'yes' : 'no')
      );
    } catch (error) {
      freshnessPanelState('Batch refresh failed: ' + error.message);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = 'Refresh visible sources';
      }
    }
  }

  function renderSources(sources) {
    const box = document.getElementById('monitorScheduleSources');
    if (!box) return;
    if (!sources.length) {
      box.innerHTML = '<span class="result">No active monitored sources are available.</span>';
      return;
    }
    box.innerHTML = sources.map((source) => {
      const id = typeof source === 'string' ? source : source.id;
      const name = typeof source === 'string' ? source : source.name;
      return '<label class="pref"><input type="checkbox" data-schedule-source="' +
        esc(id) + '"> <span>' + esc(name) + '</span></label>';
    }).join('');
  }

  function renderSchedules(schedules) {
    const box = document.getElementById('monitorScheduleList');
    if (!box) return;
    if (!schedules.length) {
      box.innerHTML = '<div class="result">No user-owned monitoring schedules yet.</div>';
      return;
    }

    box.innerHTML = schedules.map((schedule) => {
      const scope = Array.isArray(schedule.sourceIds) && schedule.sourceIds.length
        ? schedule.sourceIds.join(', ')
        : 'All active monitored sources';

      return '<div class="evidence" style="margin-top:8px">' +
        '<strong>' + esc(schedule.name) + '</strong> · ' +
        (schedule.enabled ? 'ENABLED' : 'DISABLED') +
        '<br><small>Every ' + esc(schedule.cadenceDays) + ' day(s)' +
        '<br>Scope: ' + esc(scope) +
        '<br>Next run: ' + esc(schedule.nextRunAt || 'UNKNOWN') +
        '<br>Last run: ' + esc(schedule.lastRunAt || 'NEVER') +
        '</small>' +
        '<div class="prefs-actions">' +
        '<button type="button" class="save-search" data-schedule-toggle="' + esc(schedule.id) + '">' +
          (schedule.enabled ? 'Disable' : 'Enable') +
        '</button>' +
        '<button type="button" class="save-search" data-schedule-delete="' + esc(schedule.id) + '">Delete</button>' +
        '</div></div>';
    }).join('');

    box.querySelectorAll('[data-schedule-toggle]').forEach((button) => {
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          const response = await request('/api/monitor-schedules?id=' + encodeURIComponent(button.dataset.scheduleToggle), {
            method: 'PATCH',
            body: JSON.stringify({
              id: button.dataset.scheduleToggle,
              schedule: {
                enabled: button.textContent.trim() === 'Disable' ? false : true
              }
            })
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Schedule update failed');
          await loadSchedules();
          setState('Schedule updated.');
        } catch (error) {
          setState('Schedule update failed: ' + error.message);
        } finally {
          button.disabled = false;
        }
      });
    });

    box.querySelectorAll('[data-schedule-delete]').forEach((button) => {
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          const response = await request('/api/monitor-schedules?id=' + encodeURIComponent(button.dataset.scheduleDelete), {
            method: 'DELETE'
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Schedule delete failed');
          await loadSchedules();
          setState('Schedule deleted.');
        } catch (error) {
          setState('Schedule delete failed: ' + error.message);
        } finally {
          button.disabled = false;
        }
      });
    });
  }

  async function loadSources() {
    const response = await request('/api/status');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Runtime status load failed');
    const sources = data.runtime && Array.isArray(data.runtime.monitoredSources)
      ? data.runtime.monitoredSources
      : [];
    renderSources(sources);
  }

  async function loadSchedules() {
    const response = await request('/api/monitor-schedules');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Schedule load failed');
    renderSchedules(Array.isArray(data.schedules) ? data.schedules : []);
    setState(
      'Schedules: ' + data.count +
      ' · storage: ' + data.storage +
      ' · durable: ' + (data.durable ? 'yes' : 'no')
    );
  }

  async function createSchedule() {
    const nameInput = document.getElementById('monitorScheduleName');
    const cadenceInput = document.getElementById('monitorScheduleCadence');
    const categories = [...document.querySelectorAll('[data-schedule-source]:checked')]
      .map((input) => input.dataset.scheduleSource);

    const response = await request('/api/monitor-schedules', {
      method: 'POST',
      body: JSON.stringify({
        schedule: {
          name: nameInput.value.trim() || 'Monitoring schedule',
          cadenceDays: Number(cadenceInput.value),
          sourceIds: categories
        }
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Schedule creation failed');
    await loadSchedules();
    nameInput.value = '';
    document.querySelectorAll('[data-schedule-source]').forEach((input) => { input.checked = false; });
    setState('Schedule created. Next run: ' + data.schedule.nextRunAt);
  }

  async function connectAndLoad() {
    if (!token()) {
      setState('Connect an authenticated identity in Alert subscriptions first.');
      return;
    }
    try {
      await Promise.all([loadSources(), loadSchedules()]);
    } catch (error) {
      setState('Schedule load failed: ' + error.message);
    }
  }

  function install() {
    const controls = document.querySelector('.controls');
    const syncState = document.getElementById('syncState');
    if (!controls || !syncState) return;

    const button = document.createElement('button');
    button.id = 'monitorSchedulesBtn';
    button.className = 'save-search';
    button.textContent = 'Monitoring schedules';
    controls.appendChild(button);

    const freshnessButton = document.createElement('button');
    freshnessButton.id = 'freshnessControlBtn';
    freshnessButton.className = 'save-search';
    freshnessButton.textContent = 'Freshness control';
    controls.appendChild(freshnessButton);

    const panel = document.createElement('div');
    panel.id = 'monitorSchedulesPanel';
    panel.className = 'notice';
    panel.style.display = 'none';
    panel.innerHTML =
      '<strong>Monitoring schedules</strong>' +
      '<div class="result">Authenticated user-owned cadence rules. Actual execution is bounded by the platform scheduler tick.</div>' +
      '<div class="prefs-actions">' +
        '<input id="monitorScheduleName" placeholder="Schedule name" maxlength="60">' +
        '<select id="monitorScheduleCadence">' +
          CADENCES.map((days) => '<option value="' + days + '">' + days + ' day' + (days === 1 ? '' : 's') + '</option>').join('') +
        '</select>' +
        '<button id="createMonitorScheduleBtn" class="save-search">Create</button>' +
      '</div>' +
      '<div class="result">Source scope (leave all unchecked for all active monitored sources):</div>' +
      '<div id="monitorScheduleSources" class="prefs-grid"></div>' +
      '<div class="prefs-actions"><button id="refreshMonitorSchedulesBtn" class="save-search">Refresh</button></div>' +
      '<div id="monitorScheduleList"></div>' +
      '<div id="monitorScheduleState" class="result">Not connected.</div>';

    syncState.parentNode.insertBefore(panel, syncState.nextSibling);
    syncState.parentNode.insertBefore(freshnessPanel, panel.nextSibling);

    freshnessButton.addEventListener('click', () => {
      freshnessPanel.style.display = freshnessPanel.style.display === 'none' ? 'block' : 'none';
      if (freshnessPanel.style.display !== 'none') loadFreshnessStatus();
    });

    document.getElementById('refreshVisibleSourcesBtn').addEventListener('click', refreshVisibleSources);
    document.getElementById('refreshFreshnessStatusBtn').addEventListener('click', loadFreshnessStatus);

    button.addEventListener('click', () => {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      if (panel.style.display !== 'none') connectAndLoad();
    });

    document.getElementById('createMonitorScheduleBtn').addEventListener('click', async () => {
      if (!token()) {
        setState('Connect an authenticated identity in Alert subscriptions first.');
        return;
      }
      try {
        await createSchedule();
      } catch (error) {
        setState('Create failed: ' + error.message);
      }
    });

    document.getElementById('refreshMonitorSchedulesBtn').addEventListener('click', connectAndLoad);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
