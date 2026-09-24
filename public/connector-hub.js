(function exposeHafizeConnectorHub(root) {
  'use strict';

  const HEALTH_URL = '/api/health';
  const GMAIL_STATUS_URL = '/api/connectors/gmail/status';
  const CANVA_STATUS_URL = '/api/connectors/canva/status';
  const SESSION_KEY = 'hafize.connector-hub.v1';
  const CARD_IDS = Object.freeze([
    'accountConnectionCard',
    'gmailConnectionCard',
    'canvaConnectionCard',
    'githubWriteReadinessCard'
  ]);
  const REQUEST_TIMEOUT_MS = 8000;
  const REFRESH_COOLDOWN_MS = 900;
  const STYLE_ID = 'connectorHubStyle';
  const STYLE_PATH = '/connector-hub.css';
  const EVENT = 'hafize:connector-hub-changed';

  const PROVIDERS = Object.freeze({
    github: Object.freeze({
      label: 'GitHub',
      description: 'Repository okuma ve çalışma alanı verileri.',
      detail: 'Tarayıcı GitHub tokenı görmez; yazma işlemleri bu yüzeyde etkin değildir.'
    }),
    gmail: Object.freeze({
      label: 'Google / Gmail',
      description: 'Gmail salt-okunur erişimi.',
      detail: 'Bağlantı durumu sunucudan kontrol edilir; OAuth tokenı tarayıcı storageına yazılmaz.'
    }),
    canva: Object.freeze({
      label: 'Canva',
      description: 'Canva salt-okunur varlık ve tasarım verileri.',
      detail: 'Bağlantı durumu kullanıcı oturumu üzerinden sunucuda sorgulanır.'
    })
  });

  function makeText(documentRef, value, className) {
    const node = documentRef.createElement('span');
    if (className) node.className = className;
    node.textContent = String(value == null ? '' : value);
    return node;
  }

  function makeButton(documentRef, label, className) {
    const node = documentRef.createElement('button');
    node.type = 'button';
    node.className = className || 'connector-hub-btn';
    node.textContent = label;
    return node;
  }

  function getSessionStorage(rootRef) {
    try { return rootRef.sessionStorage || null; } catch { return null; }
  }

  function readCollapsed(rootRef) {
    try {
      const raw = getSessionStorage(rootRef)?.getItem(SESSION_KEY);
      const parsed = JSON.parse(raw || '{}');
      return parsed && typeof parsed === 'object' && parsed.collapsed === true;
    } catch {
      return false;
    }
  }

  function writeCollapsed(rootRef, collapsed) {
    try {
      getSessionStorage(rootRef)?.setItem(
        SESSION_KEY,
        JSON.stringify({ collapsed: collapsed === true })
      );
    } catch {}
  }

  function installStyle(documentRef) {
    if (!documentRef?.head || typeof documentRef.createElement !== 'function') return null;
    const existing = documentRef.getElementById(STYLE_ID);
    if (existing) return Object.freeze({ owned: false, node: existing });
    const link = documentRef.createElement('link');
    link.id = STYLE_ID;
    link.rel = 'stylesheet';
    link.href = STYLE_PATH;
    documentRef.head.append(link);
    return Object.freeze({ owned: true, node: link });
  }

  function makeStatusRow(documentRef, key, label, state, detail) {
    const row = documentRef.createElement('div');
    row.className = 'connector-hub-status-row';
    row.dataset.connector = key;
    row.append(
      makeText(documentRef, label, 'connector-hub-provider'),
      makeText(documentRef, state, 'connector-hub-state'),
      makeText(documentRef, detail, 'connector-hub-detail')
    );
    return row;
  }

  function makeCard(documentRef, id, title, description) {
    const section = documentRef.createElement('section');
    section.id = id;
    section.className = 'utility-card connector-hub-card';
    section.setAttribute('aria-labelledby', id + 'Title');

    const head = documentRef.createElement('div');
    head.className = 'connector-hub-head';

    const titleNode = documentRef.createElement('strong');
    titleNode.id = id + 'Title';
    titleNode.textContent = title;

    const badge = makeText(documentRef, 'Bekleniyor', 'connector-hub-badge');
    head.append(titleNode, badge);
    section.append(head, makeText(documentRef, description, 'connector-hub-description'));

    return Object.freeze({ section, head, badge });
  }

  function createController(documentRef = root.document, rootRef = root) {
    const rail = documentRef?.querySelector?.('.utility-rail');
    if (!documentRef || !rail || typeof documentRef.createElement !== 'function') return null;
    if (documentRef.getElementById('connectorHubMarker')) return null;

    const marker = documentRef.createElement('span');
    marker.id = 'connectorHubMarker';
    marker.hidden = true;
    marker.setAttribute('aria-hidden', 'true');
    rail.prepend(marker);

    const style = installStyle(documentRef);
    if (!style) {
      marker.remove();
      return null;
    }

    const listeners = [];
    const cards = [];
    let destroyed = false;
    let refreshInFlight = false;
    let lastRefreshAt = 0;
    let collapsed = readCollapsed(rootRef);

    function on(target, type, handler) {
      if (!target?.addEventListener || !target?.removeEventListener) return;
      target.addEventListener(type, handler);
      listeners.push(() => target.removeEventListener(type, handler));
    }

    const overall = makeCard(
      documentRef,
      'accountConnectionCard',
      'Bağlantılar',
      'Kullanıcı oturumuna bağlı connector durumlarını tek yerde gör.'
    );
    const gmail = makeCard(
      documentRef,
      'gmailConnectionCard',
      PROVIDERS.gmail.label,
      PROVIDERS.gmail.description
    );
    const canva = makeCard(
      documentRef,
      'canvaConnectionCard',
      PROVIDERS.canva.label,
      PROVIDERS.canva.description
    );
    const github = makeCard(
      documentRef,
      'githubWriteReadinessCard',
      PROVIDERS.github.label,
      PROVIDERS.github.description
    );
    cards.push(overall.section, gmail.section, canva.section, github.section);

    const body = documentRef.createElement('div');
    body.id = 'connectorHubBody';
    body.className = 'connector-hub-body';

    const privacy = makeText(
      documentRef,
      'Kimlik bilgileri tarayıcıda gösterilmez; durum sorguları GET ile yapılır.',
      'connector-hub-privacy'
    );
    const refresh = makeButton(documentRef, 'Durumları yenile', 'connector-hub-btn connector-hub-refresh');
    const refreshRow = documentRef.createElement('div');
    refreshRow.className = 'connector-hub-summary-actions';
    refreshRow.append(privacy, refresh);

    const last = makeText(documentRef, 'Henüz yenilenmedi.', 'connector-hub-last');
    body.append(refreshRow, last);

    const toggle = makeButton(documentRef, collapsed ? 'Göster' : 'Gizle');
    toggle.className = 'connector-hub-btn connector-hub-toggle';
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-controls', 'connectorHubBody');
    overall.head.append(toggle);
    overall.section.append(body);

    const gmailBody = documentRef.createElement('div');
    gmailBody.className = 'connector-hub-provider-body';
    gmail.section.append(gmailBody);

    const canvaBody = documentRef.createElement('div');
    canvaBody.className = 'connector-hub-provider-body';
    canva.section.append(canvaBody);

    const githubBody = documentRef.createElement('div');
    githubBody.className = 'connector-hub-provider-body';
    githubBody.append(
      makeStatusRow(
        documentRef,
        'github',
        'Salt-okunur erişim',
        'Bekleniyor',
        'Sunucu yapılandırması kontrol ediliyor.'
      ),
      makeText(
        documentRef,
        'Yazma, branch oluşturma, commit ve PR merge işlemleri bu panelden çalıştırılmaz.',
        'connector-hub-note'
      )
    );
    github.section.append(githubBody);

    rail.prepend(overall.section, gmail.section, canva.section, github.section);

    function setBadge(cardRef, value, stateKey) {
      cardRef.badge.textContent = value;
      cardRef.badge.dataset.state = String(stateKey || value).toLowerCase();
    }

    function renderProvider(bodyRef, cardRef, key, state, detail) {
      bodyRef.replaceChildren(
        makeStatusRow(documentRef, key, 'Bağlantı', state, detail)
      );
      setBadge(cardRef, state, state);
    }

    function renderGmail(payload) {
      if (payload?.error === 'AUTH_REQUIRED') {
        renderProvider(
          gmailBody,
          gmail,
          'gmail',
          'Oturum gerekli',
          'Uygulama oturumu olmadan durum okunamaz.'
        );
        return;
      }
      if (payload?.linked === true) {
        renderProvider(gmailBody, gmail, 'gmail', 'Bağlı', PROVIDERS.gmail.detail);
        return;
      }
      if (payload?.error === 'GMAIL_NOT_CONFIGURED') {
        renderProvider(
          gmailBody,
          gmail,
          'gmail',
          'Devre dışı',
          'Sunucu connector kimliği yapılandırılmamış.'
        );
        return;
      }
      renderProvider(
        gmailBody,
        gmail,
        'gmail',
        'Bağlı değil',
        'Google hesabı bağlantısı bulunmuyor.'
      );
    }

    function renderCanva(payload) {
      if (payload?.error === 'AUTH_REQUIRED') {
        renderProvider(
          canvaBody,
          canva,
          'canva',
          'Oturum gerekli',
          'Uygulama oturumu olmadan durum okunamaz.'
        );
        return;
      }
      if (payload?.linked === true) {
        renderProvider(canvaBody, canva, 'canva', 'Bağlı', PROVIDERS.canva.detail);
        return;
      }
      if (payload?.error === 'CANVA_NOT_CONFIGURED') {
        renderProvider(
          canvaBody,
          canva,
          'canva',
          'Devre dışı',
          'Sunucu Canva connector kimliği yapılandırılmamış.'
        );
        return;
      }
      renderProvider(
        canvaBody,
        canva,
        'canva',
        'Bağlı değil',
        'Canva hesabı bağlantısı bulunmuyor.'
      );
    }

    function renderHealth(payload) {
      const values = [
        ['github', 'GitHub', payload?.githubReadConfigured === true],
        ['gmail', 'Google / Gmail', payload?.gmailReadConfigured === true],
        ['canva', 'Canva', payload?.canvaReadConfigured === true]
      ];

      overall.section.querySelectorAll('.connector-hub-status-row').forEach((node) => {
        node.remove();
      });

      const fragment = documentRef.createDocumentFragment();
      for (const value of values) {
        fragment.append(
          makeStatusRow(
            documentRef,
            value[0],
            value[1],
            value[2] ? 'Hazır' : 'Kapalı',
            value[2]
              ? 'Sunucu connector kapasitesi hazır.'
              : 'Sunucu connector kapasitesi kapalı.'
          )
        );
      }
      overall.head.after(fragment);

      const ready = values.filter((value) => value[2]).length;
      setBadge(overall, ready + '/' + values.length + ' hazır', ready + '/' + values.length);
      return ready;
    }

    function formatTime() {
      try {
        return new Intl.DateTimeFormat('tr-TR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }).format(new Date());
      } catch {
        return 'şimdi';
      }
    }

    async function getJson(url) {
      if (typeof rootRef.fetch !== 'function') {
        return Object.freeze({ error: 'FETCH_UNAVAILABLE' });
      }

      const Controller = rootRef.AbortController;
      const controller = typeof Controller === 'function' ? new Controller() : null;
      const timer = controller
        ? rootRef.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
        : 0;

      try {
        const response = await rootRef.fetch(url, {
          method: 'GET',
          credentials: 'same-origin',
          headers: { accept: 'application/json' },
          signal: controller?.signal
        });

        if (!response?.ok) {
          let payload = {};
          try { payload = await response.json(); } catch {}
          return Object.freeze({
            error: payload?.error || 'HTTP_' + String(response?.status || 0)
          });
        }

        return await response.json();
      } catch (error) {
        return Object.freeze({
          error: error?.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR'
        });
      } finally {
        if (timer) rootRef.clearTimeout(timer);
      }
    }

    async function refreshStatus({ force = false } = {}) {
      const now = Date.now();
      if (refreshInFlight || (!force && now - lastRefreshAt < REFRESH_COOLDOWN_MS)) {
        return false;
      }

      refreshInFlight = true;
      lastRefreshAt = now;
      refresh.disabled = true;
      refresh.textContent = 'Yenileniyor…';

      let health;
      let gmailStatus;
      let canvaStatus;
      try {
        [health, gmailStatus, canvaStatus] = await Promise.all([
          getJson(HEALTH_URL),
          getJson(GMAIL_STATUS_URL),
          getJson(CANVA_STATUS_URL)
        ]);

        if (destroyed) return false;

        renderHealth(health);
        renderGmail(gmailStatus);
        renderCanva(canvaStatus);

        const failures = [health, gmailStatus, canvaStatus].filter((item) => {
          return item?.error &&
            !['AUTH_REQUIRED', 'GMAIL_NOT_CONFIGURED', 'CANVA_NOT_CONFIGURED'].includes(item.error);
        });
        const connected = [
          gmailStatus?.linked === true,
          canvaStatus?.linked === true
        ].filter(Boolean).length;

        overall.section.dataset.connectedCount = String(connected);
        last.textContent = failures.length
          ? 'Bazı durumlar okunamadı · ' + formatTime()
          : 'Son yenileme · ' + formatTime();

        rootRef.dispatchEvent?.(
          new rootRef.CustomEvent(EVENT, {
            detail: { connected, failures: failures.length }
          })
        );
        return failures.length === 0;
      } finally {
        if (!destroyed) {
          refresh.disabled = false;
          refresh.textContent = 'Durumları yenile';
          refreshInFlight = false;
        }
      }
    }

    function applyCollapse() {
      body.hidden = collapsed;
      toggle.textContent = collapsed ? 'Göster' : 'Gizle';
      toggle.setAttribute('aria-expanded', String(!collapsed));
    }

    function onToggle() {
      collapsed = !collapsed;
      writeCollapsed(rootRef, collapsed);
      applyCollapse();
    }

    on(toggle, 'click', onToggle);
    on(refresh, 'click', () => { refreshStatus({ force: true }); });
    on(rootRef, EVENT, () => {
      if (!destroyed) refreshStatus();
    });

    applyCollapse();
    refreshStatus({ force: true });

    return Object.freeze({
      mount: true,
      refresh: refreshStatus,
      getState: () => Object.freeze({
        collapsed,
        refreshing: refreshInFlight
      }),
      destroy: () => {
        if (destroyed) return;
        destroyed = true;
        while (listeners.length) {
          try { listeners.pop()(); } catch {}
        }
        cards.forEach((node) => node.remove());
        marker.remove();
        if (style.owned) style.node.remove();
      }
    });
  }

  const api = Object.freeze({
    HEALTH_URL,
    GMAIL_STATUS_URL,
    CANVA_STATUS_URL,
    SESSION_KEY,
    CARD_IDS,
    PROVIDERS,
    createController,
    mount: function mount(documentRef, rootRef) {
      try {
        return createController(documentRef, rootRef);
      } catch {
        return null;
      }
    }
  });

  root.HafizeConnectorHub = api;

  const start = () => {
    const controller = api.mount(root.document, root);
    if (controller) {
      root.HafizeConnectorHubController = controller;
    }
    return controller;
  };

  if (root.document?.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})(typeof globalThis !== 'undefined' ? globalThis : self);
