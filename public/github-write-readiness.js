(function exposeHafizeGitHubWriteReadiness(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) { module.exports = api; return; }
  root.HafizeGitHubWriteReadiness = api;
  api.mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeGitHubWriteReadiness() {
  'use strict';

  const HEALTH_PATH = '/api/health';
  const CARD_ID = 'githubWriteReadinessCard';
  const STATUS_ID = 'githubWriteReadinessSummary';

  function normalizeHealth(value) {
    if (!value || Array.isArray(value) || typeof value !== 'object') return null;
    if (typeof value.githubWriteConfigured !== 'boolean') return null;
    return Object.freeze({ githubWriteConfigured: value.githubWriteConfigured });
  }

  function deriveSummary(health) {
    if (!health) return Object.freeze({ state: 'error', text: 'GitHub yazma sınırı durumu alınamadı.' });
    return health.githubWriteConfigured
      ? Object.freeze({ state: 'ready', text: 'GitHub yazma sınırı hazır; her yazma ayrı açık onay gerektirir.' })
      : Object.freeze({ state: 'off', text: 'GitHub yazma kapalı; salt-okunur repo araçları kullanılabilir.' });
  }

  function createController({ documentRef = globalThis.document, fetchImpl = globalThis.fetch } = {}) {
    if (!documentRef || typeof documentRef.querySelector !== 'function' || typeof documentRef.createElement !== 'function') {
      throw new Error('INVALID_GITHUB_WRITE_READINESS_DOCUMENT');
    }
    if (typeof fetchImpl !== 'function') throw new Error('GITHUB_WRITE_READINESS_FETCH_UNAVAILABLE');

    let mounted = false;
    let card = null;
    let status = null;
    let badge = null;
    let refresh = null;
    let requestController = null;

    function element(tag, className, text) {
      const node = documentRef.createElement(tag);
      if (className) node.className = className;
      if (text) node.textContent = text;
      return node;
    }

    function buildCard() {
      const rail = documentRef.querySelector('.utility-rail');
      if (!rail) return false;
      const existing = documentRef.querySelector(`#${CARD_ID}`);
      if (existing) { card = existing; return false; }

      card = element('section', 'utility-card github-write-readiness-card');
      card.id = CARD_ID;
      card.setAttribute('aria-labelledby', 'githubWriteReadinessTitle');
      card.setAttribute('aria-busy', 'true');

      const head = element('div', 'utility-head github-write-readiness-head');
      const titleWrap = element('span', 'github-write-readiness-title');
      const icon = element('span', 'mini-icon', '⌘');
      icon.setAttribute('aria-hidden', 'true');
      const title = element('span', '', 'GitHub yazma');
      title.id = 'githubWriteReadinessTitle';
      titleWrap.append(icon, title);
      refresh = element('button', 'mini-btn github-write-readiness-refresh', 'Yenile');
      refresh.type = 'button';
      refresh.setAttribute('aria-label', 'GitHub yazma sınırı durumunu yenile');
      head.append(titleWrap, refresh);

      status = element('p', 'github-write-readiness-summary', 'GitHub yazma sınırı kontrol ediliyor…');
      status.id = STATUS_ID;
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      status.setAttribute('aria-atomic', 'true');

      const boundary = element('div', 'github-write-readiness-boundary');
      const boundaryLabel = element('span', '', 'Onay sınırı');
      badge = element('strong', 'github-write-readiness-badge', 'Kontrol ediliyor');
      badge.dataset.state = 'unknown';
      boundary.append(boundaryLabel, badge);

      const rules = element('ul', 'github-write-readiness-rules');
      for (const text of [
        'Branch/commit/PR yazımı yalnız sunucu tarafı approval boundary üzerinden çalışır.',
        'Merge, repo silme ve secret görüntüleme bu kart tarafından başlatılamaz.',
        'Bu kart token, repo allowlist’i veya onay secret’ı göstermez.'
      ]) {
        const item = element('li', '', text);
        rules.append(item);
      }

      card.append(head, status, boundary, rules);
      const scheduleCard = rail.querySelector?.('#scheduleRuntimeCard');
      if (scheduleCard?.nextSibling && typeof rail.insertBefore === 'function') rail.insertBefore(card, scheduleCard.nextSibling);
      else rail.append(card);
      return true;
    }

    function render(health) {
      const summary = deriveSummary(health);
      if (status) {
        status.textContent = summary.text;
        status.dataset.state = summary.state;
      }
      if (badge) {
        badge.textContent = !health ? 'Bilinmiyor' : health.githubWriteConfigured ? 'Açık onay gerekli' : 'Kapalı';
        badge.dataset.state = !health ? 'unknown' : health.githubWriteConfigured ? 'ready' : 'off';
      }
      card?.setAttribute?.('aria-busy', 'false');
    }

    async function load() {
      requestController?.abort?.();
      requestController = typeof AbortController === 'function' ? new AbortController() : null;
      card?.setAttribute?.('aria-busy', 'true');
      if (refresh) refresh.disabled = true;
      try {
        const response = await fetchImpl(HEALTH_PATH, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          cache: 'no-store',
          credentials: 'same-origin',
          ...(requestController ? { signal: requestController.signal } : {})
        });
        if (!response?.ok) throw new Error('GITHUB_WRITE_READINESS_HTTP_ERROR');
        const health = normalizeHealth(await response.json());
        if (!health) throw new Error('GITHUB_WRITE_READINESS_INVALID_RESPONSE');
        render(health);
        return health;
      } catch (error) {
        if (error?.name !== 'AbortError') render(null);
        return null;
      } finally {
        if (refresh) refresh.disabled = false;
      }
    }

    function mount() {
      if (mounted) return false;
      buildCard();
      if (!card || !refresh) return false;
      refresh.addEventListener?.('click', load);
      mounted = true;
      void load();
      return true;
    }

    function destroy() {
      if (!mounted) return false;
      requestController?.abort?.();
      refresh?.removeEventListener?.('click', load);
      card?.remove?.();
      card = null;
      status = null;
      badge = null;
      refresh = null;
      mounted = false;
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

  return Object.freeze({ HEALTH_PATH, CARD_ID, STATUS_ID, normalizeHealth, deriveSummary, createController, mount });
});
