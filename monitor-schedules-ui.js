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
