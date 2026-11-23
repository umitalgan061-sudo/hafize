// @ts-nocheck
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
  const CAPABILITIES = Object.freeze({
    github: Object.freeze(['repository.read', 'directory.read', 'compare.read', 'commit.read', 'pull.read']),
    gmail: Object.freeze(['gmail.read']),
    canva: Object.freeze(['profile.read', 'asset.read', 'design.meta.read', 'design.content.read'])
  });

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
  // Cards below describe deliberate connection boundaries. They never imply that a
  // browser session, password, cookie or API key has been copied to Hafize.
  const CONNECTION_CATALOG = Object.freeze([
    { id: 'shadcnConnectionCard', label: 'shadcn/ui', description: 'Kopyalanabilir, eri\u015filebilir aray\u00fcz temelleri ve registry.', detail: 'Kaynak kod proje i\u00e7ine eklenmeden \u00f6nce Hafize de\u011fi\u015fikli\u011fi g\u00f6sterir ve onay ister.', capabilities: ['component.search', 'registry.review', 'approval.required'], url: 'https://ui.shadcn.com/' },
    { id: 'magicUiConnectionCard', label: 'Magic UI', description: 'Hafif hareketli bloklar, par\u00e7ac\u0131klar ve hero bile\u015fenleri.', detail: 'Animasyon performans\u0131 mobil ve hareketi azalt tercihiyle birlikte de\u011ferlendirilir.', capabilities: ['animation.reference', 'component.review', 'reduced-motion.required'], url: 'https://magicui.design/docs/components' },
    { id: 'aceternityConnectionCard', label: 'Aceternity UI', description: 'React ve Tailwind i\u00e7in g\u00f6rsel bloklar ve etkile\u015fimler.', detail: 'Bile\u015fen kaynak kodu ve lisans\u0131 uygulanmadan \u00f6nce incelenir.', capabilities: ['landing-page.reference', 'component.review', 'license.review'], url: 'https://ui.aceternity.com/' },
    { id: 'motionPrimitivesConnectionCard', label: 'Motion Primitives', description: 'Motion tabanl\u0131 ince ge\u00e7i\u015f ve mikro etkile\u015fimler.', detail: 'Projeye ekleme \u00f6ncesinde gerekli ba\u011f\u0131ml\u0131l\u0131klar ve eri\u015filebilirlik etkisi a\u00e7\u0131k\u00e7a sunulur.', capabilities: ['motion.reference', 'dependency.review', 'approval.required'], url: 'https://motion-primitives.com/docs/installation' },
    { id: 'reactBitsConnectionCard', label: 'React Bits', description: '\u00dccretsiz kaynak-kodlu hareketli React bile\u015fenleri ve arka planlar.', detail: 'Hafize, kaynak kodu projeye almadan \u00f6nce performans ve lisans incelemesi yapar.', capabilities: ['animation.reference', 'source.review', 'license.review'], url: 'https://www.reactbits.dev/' },
    { id: 'v0ConnectionCard', label: 'v0', description: 'Metinden React aray\u00fcz tasla\u011f\u0131 ve g\u00f6rsel iterasyon.', detail: 'Bu ayr\u0131 bir hesap/oturum gerektirir; Hafize otomatik oturum devralmaz veya yay\u0131n yapmaz.', capabilities: ['ui.prototype', 'export.review', 'approval.required'], url: 'https://v0.dev/' },
    { id: 'twentyFirstConnectionCard', label: '21st', description: 'Bileşen arama ve proje entegrasyonu.', detail: '21st MCP/API anahtarıyla bağlanır; anahtar sohbet mesajına yazılmaz.', capabilities: ['component.search', 'component.install', 'approval.required'] },
    { id: 'browserBridgeConnectionCard', label: 'Tarayıcı köprüsü', description: 'Açık sitelerde, seçilen sekmeyle çalışır.', detail: 'Oturum çerezleri Hafize sunucusuna aktarılmaz. Gönderme, silme, yükleme ve ödeme her zaman onay ister.', capabilities: ['tab.read', 'approval.required', 'no.cookie.export'] },
    { id: 'calendarConnectionCard', label: 'Takvim', description: 'Etkinlikleri oku ve onayla oluştur.', detail: 'OAuth kapsamları bağlantı sırasında görünür; yazma işlemleri onay ister.', capabilities: ['calendar.read', 'calendar.write', 'approval.required'] },
    { id: 'notionConnectionCard', label: 'Notion', description: 'Sayfa ve veritabanı çalışma alanı.', detail: 'Yalnız seçilen Notion sayfalarına erişim verilmelidir.', capabilities: ['page.read', 'database.read', 'approval.required'] },
    { id: 'slackConnectionCard', label: 'Slack', description: 'Kanalları ara ve taslak yanıt hazırla.', detail: 'Mesaj gönderme yalnız açık kullanıcı onayıyla yapılır.', capabilities: ['channel.read', 'message.draft', 'approval.required'] },
    { id: 'figmaConnectionCard', label: 'Figma', description: 'Dosya, tasarım ve bileşen bağlamı.', detail: 'Salt-okunur tasarım incelemesi için planlanmıştır.', capabilities: ['file.read', 'component.read'] },
    { id: 'linearConnectionCard', label: 'Linear', description: 'Issue ve proje takibi.', detail: 'Issue oluşturma veya güncelleme kullanıcı onayı gerektirir.', capabilities: ['issue.read', 'issue.write', 'approval.required'] },
    { id: 'storageConnectionCard', label: 'Dosya alanı', description: 'Dropbox, Box ve SharePoint dosyaları.', detail: 'İndirilen dosyalar yalnız görevin süresi boyunca işlenir; paylaşım değişikliği onay ister.', capabilities: ['file.read', 'file.upload', 'approval.required'] }
  ]);

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

  function makeSafeExternalLink(documentRef, href, label) {
    if (typeof href !== 'string' || !/^https:\/\//.test(href)) return null;
    const link = documentRef.createElement('a');
    link.className = 'connector-hub-link';
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = label;
    return link;
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
    const catalogCards = CONNECTION_CATALOG.map((connector) => {
      const card = makeCard(documentRef, connector.id, connector.label, connector.description);
      const providerBody = documentRef.createElement('div');
      providerBody.className = 'connector-hub-provider-body';
      providerBody.append(
        makeStatusRow(documentRef, connector.id, 'Bağlantı', 'Hazırlanıyor', connector.detail),
        makeText(documentRef, 'Planlanan yetenekler', 'connector-hub-capability-title')
      );
      const capabilities = documentRef.createElement('div');
      capabilities.className = 'connector-hub-capabilities';
      connector.capabilities.forEach((capability) => capabilities.append(makeText(documentRef, capability, 'connector-hub-capability')));
      const link = makeSafeExternalLink(documentRef, connector.url, 'Kaynağı aç');
      providerBody.append(capabilities, makeText(documentRef, 'Bu kart bağlantı kurulmadan hiçbir hesaba erişim vermez.', 'connector-hub-note'));
      if (link) providerBody.append(link);
      card.section.append(providerBody);
      setTimeout(() => setBadge(card, 'Hazırlanıyor', 'pending'), 0);
      return card.section;
    });
    cards.push(overall.section, gmail.section, canva.section, github.section, ...catalogCards);

    const body = documentRef.createElement('div');
    body.id = 'connectorHubBody';
    body.className = 'connector-hub-body';

    let lastSnapshot = Object.freeze({ health: null, gmail: null, canva: null });

    const privacy = makeText(
      documentRef,
      'Kimlik bilgileri tarayıcıda gösterilmez; durum sorguları GET ile yapılır.',
      'connector-hub-privacy'
    );
    const refresh = makeButton(documentRef, 'Durumları yenile', 'connector-hub-btn connector-hub-refresh');
    const diagnostics = makeButton(documentRef, 'Tanı özetini kopyala');
    const refreshRow = documentRef.createElement('div');
    refreshRow.className = 'connector-hub-summary-actions';
    refreshRow.append(privacy, refresh, diagnostics);

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

    rail.prepend(overall.section, gmail.section, canva.section, github.section, ...catalogCards);

    function setBadge(cardRef, value, stateKey) {
      cardRef.badge.textContent = value;
      cardRef.badge.dataset.state = String(stateKey || value).toLowerCase();
    }

    function renderCapabilities(bodyRef, key) {
      const values = CAPABILITIES[key] || [];
      const wrap = documentRef.createElement('div');
      wrap.className = 'connector-hub-capabilities';
      for (const value of values) {
        const chip = makeText(documentRef, value, 'connector-hub-capability');
        chip.setAttribute('role', 'note');
        wrap.append(chip);
      }
      return wrap;
    }

    function renderProvider(bodyRef, cardRef, key, state, detail) {
      bodyRef.replaceChildren(
        makeStatusRow(documentRef, key, 'Bağlantı', state, detail),
        makeText(documentRef, 'İzinli yetenekler', 'connector-hub-capability-title'),
        renderCapabilities(bodyRef, key)
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
        lastSnapshot = Object.freeze({ health, gmail: gmailStatus, canva: canvaStatus });

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

        const EventImpl = rootRef.CustomEvent || globalThis.CustomEvent;
        if (typeof EventImpl === 'function') {
          rootRef.dispatchEvent?.(
            new EventImpl(EVENT, {
              detail: { connected, failures: failures.length }
            })
          );
        }
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

    async function copyDiagnostics() {
      const snapshot = lastSnapshot;
      const lines = [
        'Hafize Bağlantılar Tanı Özeti',
        'GitHub: ' + (snapshot.health?.githubReadConfigured === true ? 'hazır' : 'kapalı'),
        'Google / Gmail: ' + (snapshot.gmail?.linked === true ? 'bağlı' : 'bağlı değil'),
        'Canva: ' + (snapshot.canva?.linked === true ? 'bağlı' : 'bağlı değil'),
        'Zaman: ' + formatTime()
      ];
      try {
        if (typeof rootRef.navigator?.clipboard?.writeText !== 'function') return;
        await rootRef.navigator.clipboard.writeText(lines.join('\\n'));
        last.textContent = 'Tanı özeti panoya kopyalandı · ' + formatTime();
      } catch {
        last.textContent = 'Tanı özeti panoya kopyalanamadı · ' + formatTime();
      }
    }

    on(toggle, 'click', onToggle);
    on(refresh, 'click', () => { refreshStatus({ force: true }); });
    on(rootRef, 'hafize:workspace-changed', (event) => {
      if (!destroyed && event?.detail?.workspace === 'connections') refreshStatus();
    });
    on(diagnostics, 'click', () => { copyDiagnostics(); });
    on(rootRef, EVENT, () => {
      if (!destroyed) refreshStatus();
    });

    applyCollapse();
    refreshStatus({ force: true });

    applyCollapse();
    refreshStatus({ force: true });

    return Object.freeze({
      mount: true,
      refresh: refreshStatus,
      getState: () => Object.freeze({
        collapsed,
        refreshing: refreshInFlight
      }),
      getSnapshot: () => lastSnapshot,
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
    CAPABILITIES,
    CONNECTION_CATALOG,
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
