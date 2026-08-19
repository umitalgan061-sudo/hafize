(function exposeHafizeCanvaConnectionStatus(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) { module.exports = api; return; }
  root.HafizeCanvaConnectionStatus = api;
  api.mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeCanvaConnectionStatus() {
  'use strict';

  const HEALTH_PATH = '/api/health';
  const STATUS_PATH = '/api/connectors/canva/status';
  const CARD_ID = 'canvaConnectionCard';
  const SUMMARY_ID = 'canvaConnectionSummary';

  function normalizeHealth(value) {
    if (!value || Array.isArray(value) || typeof value !== 'object') return null;
    return typeof value.canvaReadConfigured === 'boolean'
      ? Object.freeze({ canvaReadConfigured: value.canvaReadConfigured })
      : null;
  }

  function normalizeStatus(value) {
    if (!value || Array.isArray(value) || typeof value !== 'object') return null;
    return typeof value.linked === 'boolean' ? Object.freeze({ linked: value.linked }) : null;
  }

  function deriveView({ configured, authenticated, linked, unavailable = false }) {
    if (unavailable) {
      return Object.freeze({ state: 'error', badge: 'Bilinmiyor', text: 'Canva bağlantı durumu alınamadı.' });
    }
    if (!configured) {
      return Object.freeze({ state: 'off', badge: 'Kapalı', text: 'Canva read-only connector sunucuda yapılandırılmamış.' });
    }
    if (!authenticated) {
      return Object.freeze({ state: 'auth', badge: 'Oturum gerekli', text: 'Canva bağlantısını görmek için güvenli Hafize oturumu gerekli.' });
    }
    if (!linked) {
      return Object.freeze({ state: 'ready', badge: 'Bağlı değil', text: 'Canva connector hazır; bu kullanıcı için bağlantı bulunamadı.' });
    }
    return Object.freeze({ state: 'linked', badge: 'Bağlı', text: 'Canva read-only bağlantısı etkin.' });
  }

  function createController({ documentRef = globalThis.document, fetchImpl = globalThis.fetch, AbortControllerImpl = globalThis.AbortController } = {}) {
    if (!documentRef || typeof documentRef.querySelector !== 'function' || typeof documentRef.createElement !== 'function') {
      throw new Error('INVALID_CANVA_STATUS_DOCUMENT');
    }
    if (typeof fetchImpl !== 'function') throw new Error('CANVA_STATUS_FETCH_UNAVAILABLE');

    let mounted = false;
    let card = null;
    let summary = null;
    let badge = null;
    let refresh = null;
    let requestController = null;
    let ownsCard = false;
    let hostSnapshot = null;

    function snapshotAttribute(node, name) {
      return node?.hasAttribute?.(name)
        ? Object.freeze({ present: true, value: node.getAttribute(name) })
        : Object.freeze({ present: false, value: null });
    }

    function restoreAttribute(node, name, snapshot) {
      if (!node || !snapshot) return;
      if (snapshot.present) node.setAttribute?.(name, snapshot.value ?? '');
      else node.removeAttribute?.(name);
    }

    function captureHostState() {
      hostSnapshot = Object.freeze({
        cardBusy: snapshotAttribute(card, 'aria-busy'),
        summaryText: summary.textContent,
        summaryState: snapshotAttribute(summary, 'data-state'),
        badgeText: badge.textContent,
        badgeState: snapshotAttribute(badge, 'data-state'),
        refreshDisabled: Boolean(refresh.disabled)
      });
    }

    function restoreHostState() {
      if (!hostSnapshot || ownsCard) return;
      restoreAttribute(card, 'aria-busy', hostSnapshot.cardBusy);
      summary.textContent = hostSnapshot.summaryText;
      restoreAttribute(summary, 'data-state', hostSnapshot.summaryState);
      badge.textContent = hostSnapshot.badgeText;
      restoreAttribute(badge, 'data-state', hostSnapshot.badgeState);
      refresh.disabled = hostSnapshot.refreshDisabled;
    }

    function element(tag, className, text) {
      const node = documentRef.createElement(tag);
      if (className) node.className = className;
      if (text) node.textContent = text;
      return node;
    }

    function bindExistingCard(existing) {
      const existingSummary = existing.querySelector?.(`#${SUMMARY_ID}`);
      const existingBadge = existing.querySelector?.('.canva-connection-badge');
      const existingRefresh = existing.querySelector?.('.canva-connection-refresh');
      if (!existingSummary || !existingBadge || !existingRefresh) return false;
      card = existing;
      summary = existingSummary;
      badge = existingBadge;
      refresh = existingRefresh;
      ownsCard = false;
      captureHostState();
      return true;
    }

    function buildCard() {
      const rail = documentRef.querySelector('.utility-rail');
      if (!rail) return false;
      const existing = documentRef.querySelector(`#${CARD_ID}`);
      if (existing) return bindExistingCard(existing);

      card = element('section', 'utility-card canva-connection-card');
      card.id = CARD_ID;
      card.setAttribute('aria-labelledby', 'canvaConnectionTitle');
      card.setAttribute('aria-busy', 'true');

      const head = element('div', 'utility-head canva-connection-head');
      const titleWrap = element('span', 'canva-connection-title');
      const icon = element('span', 'mini-icon', '◈');
      icon.setAttribute('aria-hidden', 'true');
      const title = element('span', '', 'Canva Connect');
      title.id = 'canvaConnectionTitle';
      titleWrap.append(icon, title);
      badge = element('span', 'canva-connection-badge', 'Kontrol');
      badge.dataset.state = 'loading';
      head.append(titleWrap, badge);

      summary = element('p', 'canva-connection-summary', 'Canva bağlantısı kontrol ediliyor…');
      summary.id = SUMMARY_ID;
      summary.setAttribute('role', 'status');
      summary.setAttribute('aria-live', 'polite');
      summary.setAttribute('aria-atomic', 'true');

      const boundary = element('p', 'canva-connection-boundary', 'Salt-okunur bağlantı: Hafize yalnız izinli Canva okuma aracını kullanır. Tasarım yazma, paylaşma veya silme bu kart tarafından yapılmaz.');

      refresh = element('button', 'mini-btn canva-connection-refresh', 'Yenile');
      refresh.type = 'button';
      refresh.setAttribute('aria-label', 'Canva bağlantı durumunu yenile');

      card.append(head, summary, boundary, refresh);
      const scheduleCard = rail.querySelector?.('#scheduleRuntimeCard');
      if (scheduleCard && typeof rail.insertBefore === 'function') rail.insertBefore(card, scheduleCard);
      else rail.append(card);
      ownsCard = true;
      return true;
    }

    function render(view) {
      if (!view) return;
      if (summary) { summary.textContent = view.text; summary.dataset.state = view.state; }
      if (badge) { badge.textContent = view.badge; badge.dataset.state = view.state; }
      if (card) card.setAttribute('aria-busy', 'false');
    }

    async function fetchJson(path, signal) {
      return fetchImpl(path, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        credentials: 'same-origin',
        ...(signal ? { signal } : {})
      });
    }

    async function load() {
      if (!mounted) return null;
      requestController?.abort?.();
      requestController = typeof AbortControllerImpl === 'function' ? new AbortControllerImpl() : null;
      const signal = requestController?.signal;
      if (card) card.setAttribute('aria-busy', 'true');
      if (refresh) refresh.disabled = true;

      try {
        const healthResponse = await fetchJson(HEALTH_PATH, signal);
        if (!healthResponse?.ok) throw new Error('CANVA_HEALTH_HTTP_ERROR');
        const health = normalizeHealth(await healthResponse.json());
        if (!health) throw new Error('CANVA_HEALTH_INVALID_RESPONSE');
        if (!health.canvaReadConfigured) {
          const view = deriveView({ configured: false, authenticated: false, linked: false });
          render(view);
          return view;
        }

        const statusResponse = await fetchJson(STATUS_PATH, signal);
        if (statusResponse?.status === 401) {
          const view = deriveView({ configured: true, authenticated: false, linked: false });
          render(view);
          return view;
        }
        if (!statusResponse?.ok) throw new Error('CANVA_STATUS_HTTP_ERROR');
        const status = normalizeStatus(await statusResponse.json());
        if (!status) throw new Error('CANVA_STATUS_INVALID_RESPONSE');
        const view = deriveView({ configured: true, authenticated: true, linked: status.linked });
        render(view);
        return view;
      } catch (error) {
        if (error?.name === 'AbortError') return null;
        const view = deriveView({ configured: false, authenticated: false, linked: false, unavailable: true });
        render(view);
        return view;
      } finally {
        if (mounted && refresh) refresh.disabled = false;
      }
    }

    function mount() {
      if (mounted) return false;
      if (!buildCard() || !card || !summary || !badge || !refresh) return false;
      refresh.addEventListener?.('click', load);
      mounted = true;
      void load();
      return true;
    }

    function destroy() {
      if (!mounted) return false;
      mounted = false;
      requestController?.abort?.();
      refresh?.removeEventListener?.('click', load);
      if (ownsCard) card?.remove?.();
      else restoreHostState();
      card = null; summary = null; badge = null; refresh = null; requestController = null;
      ownsCard = false; hostSnapshot = null;
      return true;
    }

    return Object.freeze({ mount, destroy, load, render });
  }

  function mount(options) {
    try {
      const controller = createController(options);
      return controller.mount() ? controller : null;
    } catch {
      return null;
    }
  }

  return Object.freeze({
    HEALTH_PATH,
    STATUS_PATH,
    CARD_ID,
    SUMMARY_ID,
    normalizeHealth,
    normalizeStatus,
    deriveView,
    createController,
    mount
  });
});