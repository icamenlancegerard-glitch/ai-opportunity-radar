// MVP 3.0 — authenticated alert subscription UI adapter.
// The existing index remains a lightweight static page. This layer adds:
// - session-only identity token handling
// - server-backed alert subscription management
// - authenticated Alert Center filtering
// It never stores bearer tokens in localStorage and never handles passwords.

(() => {
  const groups = {
    source: { label: 'Source health' },
    availability: { label: 'Availability' },
    eligibility: { label: 'Philippines eligibility' },
    compensation: { label: 'Compensation' }
  };

  const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[c]));

  let authenticated = false;
  let subscriptions = [];
  let activeSubscriptionId = null;

  const tokenKey = 'ai-radar-session-token-v1';

  function getToken() {
    try { return sessionStorage.getItem(tokenKey) || ''; } catch (_) { return ''; }
  }

  function setToken(token) {
    try {
      if (token) sessionStorage.setItem(tokenKey, token);
      else sessionStorage.removeItem(tokenKey);
    } catch (_) {}
  }

  function authHeaders(extra = {}) {
    const token = getToken();
    return token ? { Authorization: 'Bearer ' + token, ...extra } : extra;
  }

  async function authFetch(path, options = {}) {
    return fetch(path, {
      ...options,
      headers: authHeaders({
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {})
      })
    });
  }

  function selectedPreferenceGroups() {
    return [...document.querySelectorAll('#prefsGrid [data-pref]:checked')]
      .map((input) => input.dataset.pref)
      .filter((group) => Object.prototype.hasOwnProperty.call(groups, group));
  }

  function setPreferenceGroups(categories) {
    const selected = new Set(Array.isArray(categories) ? categories : Object.keys(groups));
    document.querySelectorAll('#prefsGrid [data-pref]').forEach((input) => {
      input.checked = selected.has(input.dataset.pref);
    });
  }

  function subscriptionLabel(subscription) {
    return escapeHtml(subscription.name || 'Unnamed subscription');
  }

  function renderSubscriptionsPanel() {
    const panel = document.getElementById('alertSubscriptionList');
    if (!panel) return;

    if (!subscriptions.length) {
      panel.innerHTML = '<div class="result">No user-owned subscriptions yet.</div>';
      return;
    }

    panel.innerHTML = subscriptions.map((subscription) => {
      const active = subscription.id === activeSubscriptionId;
      const cats = (subscription.categories || [])
        .map((category) => groups[category]?.label || category)
        .map(escapeHtml)
        .join(', ');
      const scope = Array.isArray(subscription.sourceIds) && subscription.sourceIds.length
        ? subscription.sourceIds.join(', ')
        : 'All monitored sources';
      return '<div class="evidence" style="margin-top:8px">' +
        '<strong>' + subscriptionLabel(subscription) + '</strong> · ' +
        (subscription.enabled ? 'ENABLED' : 'DISABLED') +
        (active ? ' · ACTIVE' : '') +
        '<br><small>Categories: ' + cats +
        '<br>Scope: ' + escapeHtml(scope) +
        '<br>Updated: ' + escapeHtml(subscription.updatedAt || 'UNKNOWN') + '</small>' +
        '<div class="prefs-actions">' +
        '<button type="button" class="save-search" data-sub-use="' + escapeHtml(subscription.id) + '">Use</button>' +
        '<button type="button" class="save-search" data-sub-toggle="' + escapeHtml(subscription.id) + '">' +
          (subscription.enabled ? 'Disable' : 'Enable') + '</button>' +
        '<button type="button" class="save-search" data-sub-delete="' + escapeHtml(subscription.id) + '">Delete</button>' +
        '</div></div>';
    }).join('');

    panel.querySelectorAll('[data-sub-use]').forEach((button) => {
      button.addEventListener('click', () => {
        const subscription = subscriptions.find((item) => item.id === button.dataset.subUse);
        if (!subscription) return;
        activeSubscriptionId = subscription.id;
        setPreferenceGroups(subscription.categories);
        renderSubscriptionsPanel();
        updateSubscriptionState('Active subscription: ' + subscription.name);
      });
    });

    panel.querySelectorAll('[data-sub-toggle]').forEach((button) => {
      button.addEventListener('click', async () => {
        const subscription = subscriptions.find((item) => item.id === button.dataset.subToggle);
        if (!subscription) return;
        button.disabled = true;
        try {
          const response = await authFetch('/api/alert-subscriptions?id=' + encodeURIComponent(subscription.id), {
            method: 'PATCH',
            body: JSON.stringify({ id: subscription.id, subscription: { enabled: !subscription.enabled } })
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Subscription update failed');
          await loadSubscriptions(false);
          updateSubscriptionState('Subscription updated.');
        } catch (error) {
          updateSubscriptionState('Subscription update failed: ' + error.message);
        } finally {
          button.disabled = false;
        }
      });
    });

    panel.querySelectorAll('[data-sub-delete]').forEach((button) => {
      button.addEventListener('click', async () => {
        const subscription = subscriptions.find((item) => item.id === button.dataset.subDelete);
        if (!subscription) return;
        button.disabled = true;
        try {
          const response = await authFetch('/api/alert-subscriptions?id=' + encodeURIComponent(subscription.id), {
            method: 'DELETE'
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Subscription delete failed');
          if (activeSubscriptionId === subscription.id) activeSubscriptionId = null;
          await loadSubscriptions(false);
          updateSubscriptionState('Subscription deleted.');
        } catch (error) {
          updateSubscriptionState('Subscription delete failed: ' + error.message);
        } finally {
          button.disabled = false;
        }
      });
    });
  }

  function updateSubscriptionState(message) {
    const state = document.getElementById('alertSubscriptionState');
    if (state) state.textContent = message;
  }

  async function loadSubscriptions(createDefaultIfEmpty = true) {
    const response = await authFetch('/api/alert-subscriptions');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Subscription load failed');

    subscriptions = Array.isArray(data.subscriptions) ? data.subscriptions : [];

    if (subscriptions.length && !subscriptions.some((item) => item.id === activeSubscriptionId)) {
      activeSubscriptionId = subscriptions[0].id;
      setPreferenceGroups(subscriptions[0].categories);
    }

    if (!subscriptions.length && createDefaultIfEmpty) {
      const localPrefs = typeof window.loadAlertPreferences === 'function'
        ? window.loadAlertPreferences()
        : Object.keys(groups);

      const createResponse = await authFetch('/api/alert-subscriptions', {
        method: 'POST',
        body: JSON.stringify({
          subscription: {
            name: 'Default opportunity alerts',
            enabled: true,
            categories: localPrefs
          }
        })
      });
      const created = await createResponse.json();
      if (!createResponse.ok) throw new Error(created.error || 'Default subscription creation failed');
      subscriptions = Array.isArray(created.subscriptions) ? created.subscriptions : [created.subscription];
      activeSubscriptionId = created.subscription?.id || subscriptions[0]?.id || null;
      if (created.subscription) setPreferenceGroups(created.subscription.categories);
    }

    renderSubscriptionsPanel();

    const storage = data.storage || 'unknown';
    const durable = data.durable === true ? 'durable' : 'non-durable';
    updateSubscriptionState('Server subscriptions: ' + data.count + ' · ' + storage + ' · ' + durable);
  }

  async function createSubscriptionFromPrefs() {
    const response = await authFetch('/api/alert-subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        subscription: {
          name: 'Opportunity alerts ' + new Date().toISOString().slice(0, 10),
          enabled: true,
          categories: selectedPreferenceGroups()
        }
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Subscription creation failed');
    subscriptions = Array.isArray(data.subscriptions) ? data.subscriptions : [...subscriptions, data.subscription];
    activeSubscriptionId = data.subscription?.id || activeSubscriptionId;
    renderSubscriptionsPanel();
    updateSubscriptionState('New user-owned subscription created.');
  }

  async function saveServerPreferences() {
    const categories = selectedPreferenceGroups();
    let target = subscriptions.find((item) => item.id === activeSubscriptionId) || subscriptions[0] || null;

    if (!target) {
      await createSubscriptionFromPrefs();
      target = subscriptions.find((item) => item.id === activeSubscriptionId) || subscriptions[0] || null;
    }

    if (!target) throw new Error('No alert subscription available');

    const response = await authFetch('/api/alert-subscriptions?id=' + encodeURIComponent(target.id), {
      method: 'PATCH',
      body: JSON.stringify({
        id: target.id,
        subscription: { categories }
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Preference update failed');

    subscriptions = subscriptions.map((item) => item.id === target.id ? data.subscription : item);
    activeSubscriptionId = target.id;
    renderSubscriptionsPanel();
    updateSubscriptionState('Preferences saved to authenticated subscription.');
  }

  async function loadUserAlertCenter() {
    const panel = document.getElementById('alertCenter');
    const list = document.getElementById('alertsList');
    panel.style.display = 'block';
    list.textContent = 'Loading user-owned alerts…';

    try {
      const response = await authFetch('/api/user-alerts');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'User alert load failed');

      if (!data.activeSubscriptionCount) {
        list.textContent = 'No active alert subscription. Create or enable one in Alert subscriptions.';
        return;
      }

      if (!data.alerts.length) {
        list.innerHTML = '<div class="result">No recorded alerts match your active subscription rules.</div>';
        return;
      }

      list.innerHTML =
        '<div class="result">Showing ' + data.alerts.length +
        ' user-matched alerts from ' + data.monitoredAlerts +
        ' monitored alerts.</div>' +
        data.alerts.map((alert) =>
          '<div class="evidence">' +
          '<strong>' + escapeHtml((alert.severity || 'info').toUpperCase()) + '</strong> · ' +
          escapeHtml(alert.title || alert.code || 'Evidence change') +
          '<br><span>' + escapeHtml(alert.url || '') + '</span>' +
          '<br><small>' + escapeHtml(alert.checkedAt || '') +
          ' · subscriptions: ' + escapeHtml((alert.subscriptionIds || []).join(', ')) +
          '</small></div>'
        ).join('');
    } catch (error) {
      list.textContent = 'Authenticated Alert Center unavailable: ' + error.message;
    }
  }

  function setIdentityUi(message) {
    const state = document.getElementById('syncState');
    if (state) state.textContent = message;
    const authState = document.getElementById('alertAuthState');
    if (authState) authState.textContent = message;
  }

  async function connect(token) {
    if (!token) throw new Error('Identity provider session token is required');

    setToken(token);
    const response = await authFetch('/api/session');
    const data = await response.json();

    if (!response.ok || data.authenticated !== true) {
      setToken('');
      throw new Error(data.error || 'Authentication rejected');
    }

    authenticated = true;
    await loadSubscriptions(true);

    setIdentityUi(
      'Identity: authenticated as ' + data.subject +
      ' · alert subscriptions: ' + subscriptions.length
    );
  }

  function disconnect() {
    setToken('');
    authenticated = false;
    subscriptions = [];
    activeSubscriptionId = null;
    renderSubscriptionsPanel();
    setPreferenceGroups(typeof window.loadAlertPreferences === 'function'
      ? window.loadAlertPreferences()
      : Object.keys(groups));
    setIdentityUi('Identity: disconnected · public Alert Center fallback remains available.');
  }

  function installUi() {
    const controls = document.querySelector('.controls');
    if (!controls) return;

    const accountButton = document.createElement('button');
    accountButton.id = 'alertSubscriptionsBtn';
    accountButton.className = 'save-search';
    accountButton.textContent = 'Alert subscriptions';
    controls.appendChild(accountButton);

    const panel = document.createElement('div');
    panel.id = 'alertSubscriptionsPanel';
    panel.className = 'notice';
    panel.style.display = 'none';
    panel.innerHTML =
      '<strong>Alert subscriptions</strong>' +
      '<div class="result">Authenticated, user-owned monitoring rules. Bearer tokens are kept in session-only browser storage.</div>' +
      '<div class="prefs-actions">' +
        '<input id="alertSessionToken" type="password" autocomplete="off" placeholder="Identity provider session token">' +
        '<button id="alertConnectBtn" class="save-search">Connect</button>' +
        '<button id="alertDisconnectBtn" class="save-search">Disconnect</button>' +
      '</div>' +
      '<div id="alertAuthState" class="result">Not connected.</div>' +
      '<div class="prefs-actions">' +
        '<button id="createAlertSubscriptionBtn" class="save-search">New subscription</button>' +
      '</div>' +
      '<div id="alertSubscriptionList"></div>' +
      '<div id="alertSubscriptionState" class="result"></div>';

    const syncState = document.getElementById('syncState');
    syncState.parentNode.insertBefore(panel, syncState.nextSibling);

    accountButton.addEventListener('click', () => {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });

    document.getElementById('alertConnectBtn').addEventListener('click', async () => {
      const input = document.getElementById('alertSessionToken');
      const button = document.getElementById('alertConnectBtn');
      button.disabled = true;
      try {
        await connect(input.value.trim());
        input.value = '';
        updateSubscriptionState('Connected. Server is now the source of truth for alert subscriptions.');
      } catch (error) {
        authenticated = false;
        setIdentityUi('Authentication failed: ' + error.message);
      } finally {
        button.disabled = false;
      }
    });

    document.getElementById('alertDisconnectBtn').addEventListener('click', disconnect);

    document.getElementById('createAlertSubscriptionBtn').addEventListener('click', async () => {
      if (!authenticated) {
        updateSubscriptionState('Connect an authenticated identity first.');
        return;
      }
      try {
        await createSubscriptionFromPrefs();
      } catch (error) {
        updateSubscriptionState('Create failed: ' + error.message);
      }
    });

    const prefsSave = document.getElementById('savePrefsBtn');
    if (prefsSave) {
      const replacement = prefsSave.cloneNode(true);
      prefsSave.replaceWith(replacement);
      replacement.addEventListener('click', async () => {
        if (!authenticated) {
          if (typeof window.saveAlertPreferences === 'function') {
            window.saveAlertPreferences(selectedPreferenceGroups());
          }
          if (typeof window.renderAlertPreferences === 'function') window.renderAlertPreferences();
          return;
        }

        try {
          await saveServerPreferences();
          document.getElementById('prefsState').textContent =
            'Server-backed preferences saved. Active categories: ' + selectedPreferenceGroups().length + ' / 4';
        } catch (error) {
          document.getElementById('prefsState').textContent = 'Save failed: ' + error.message;
        }
      });
    }

    const prefsReset = document.getElementById('resetPrefsBtn');
    if (prefsReset) {
      const replacement = prefsReset.cloneNode(true);
      prefsReset.replaceWith(replacement);
      replacement.addEventListener('click', async () => {
        setPreferenceGroups(Object.keys(groups));
        if (!authenticated) {
          if (typeof window.saveAlertPreferences === 'function') {
            window.saveAlertPreferences(Object.keys(groups));
          }
          if (typeof window.renderAlertPreferences === 'function') window.renderAlertPreferences();
          return;
        }
        try {
          await saveServerPreferences();
          document.getElementById('prefsState').textContent =
            'All alert categories enabled on the active user subscription.';
        } catch (error) {
          document.getElementById('prefsState').textContent = 'Reset failed: ' + error.message;
        }
      });
    }

    const alertCenterButton = document.getElementById('alertCenterBtn');
    if (alertCenterButton) {
      const replacement = alertCenterButton.cloneNode(true);
      alertCenterButton.replaceWith(replacement);
      replacement.addEventListener('click', () => {
        if (authenticated) return loadUserAlertCenter();
        if (typeof window.loadAlertCenter === 'function') return window.loadAlertCenter();
      });
    }

    const token = getToken();
    if (token) {
      connect(token).then(() => {
        document.getElementById('alertAuthState').textContent =
          'Session restored. Authenticated alert subscriptions loaded.';
      }).catch((error) => {
        authenticated = false;
        setToken('');
        setIdentityUi('Stored session rejected: ' + error.message);
      });
    } else {
      setIdentityUi('Identity: sign-in required for user-owned alert subscriptions. Public browser-local alerts remain available.');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installUi, { once: true });
  } else {
    installUi();
  }
})();
