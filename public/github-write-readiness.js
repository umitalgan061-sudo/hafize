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
  const REQUEST_TIMEOUT_MS = 8_000;
  const ACTIVE_CARDS = new WeakSet();

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

  function requestError(code) {
    const error = new Error(code);
    error.name = 'AbortError';
    error.code = code;
    return error;
  }

  function createClient({
    fetchImpl = globalThis.fetch,
    AbortControllerImpl = globalThis.AbortController,
    setTimeoutImpl = globalThis.setTimeout,
    clearTimeoutImpl = globalThis.clearTimeout,
    timeoutMs = REQUEST_TIMEOUT_MS
  } = {}) {
    if (typeof fetchImpl !== 'function') throw new Error('GITHUB_WRITE_READINESS_FETCH_UNAVAILABLE');
    if (typeof AbortControllerImpl !== 'function') throw new Error('GITHUB_WRITE_READINESS_ABORT_CONTROLLER_UNAVAILABLE');
    if (typeof setTimeoutImpl !== 'function' || typeof clearTimeoutImpl !== 'function') throw new Error('GITHUB_WRITE_READINESS_TIMER_UNAVAILABLE');
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) throw new Error('INVALID_GITHUB_WRITE_READINESS_TIMEOUT');

    return Object.freeze({
      async load({ signal } = {}) {
        if (signal != null && (typeof signal !== 'object' || typeof signal.addEventListener !== 'function')) {
          throw new Error('INVALID_GITHUB_WRITE_READINESS_SIGNAL');
        }
        if (signal?.aborted) throw requestError('GITHUB_WRITE_READINESS_CANCELLED');
        const controller = new AbortControllerImpl();
        let timedOut = false;
        const onAbort = () => controller.abort(signal?.reason);
        signal?.addEventListener?.('abort', onAbort, { once: true });
        const timer = setTimeoutImpl(() => { timedOut = true; controller.abort(); }, timeoutMs);
        try {
          const response = await fetchImpl(HEALTH_PATH, {
            method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store', credentials: 'same-origin', signal: controller.signal
          });
          if (!response?.ok) throw new Error('GITHUB_WRITE_READINESS_HTTP_ERROR');
          const health = normalizeHealth(await response.json());
          if (!health) throw new Error('GITHUB_WRITE_READINESS_INVALID_RESPONSE');
          return health;
        } catch (error) {
          if (timedOut) throw requestError('GITHUB_WRITE_READINESS_TIMEOUT');
          if (signal?.aborted) throw requestError('GITHUB_WRITE_READINESS_CANCELLED');
          throw error;
        } finally {
          clearTimeoutImpl(timer);
          signal?.removeEventListener?.('abort', onAbort);
        }
      }
    });
  }

  function snapshotNode(node) {
    if (!node) return null;
    const read = (name) => node.getAttribute?.(name);
    return Object.freeze({
      textContent: node.textContent,
      hidden: Boolean(node.hidden),
      disabled: Boolean(node.disabled),
      ariaBusy: read('aria-busy'),
      dataState: node.dataset?.state,
      dataOwner: read('data-hafize-github-write-readiness-owner')
    });
  }

  function restoreNode(node, snapshot) {
    if (!node || !snapshot) return;
    node.textContent = snapshot.textContent;
    node.hidden = snapshot.hidden;
    node.disabled = snapshot.disabled;
    const restoreAttr = (name, value) => value == null ? node.removeAttribute?.(name) : node.setAttribute?.(name, value);
    restoreAttr('aria-busy', snapshot.ariaBusy);
    if (snapshot.dataState == null) delete node.dataset?.state;
    else node.dataset.state = snapshot.dataState;
    restoreAttr('data-hafize-github-write-readiness-owner', snapshot.dataOwner);
  }

  function createController({
    documentRef = globalThis.document,
    rootRef = globalThis,
    fetchImpl = rootRef?.fetch,
    timeoutMs = REQUEST_TIMEOUT_MS
  } = {}) {
    if (!documentRef || typeof documentRef.querySelector !== 'function' || typeof documentRef.createElement !== 'function') {
      throw new Error('INVALID_GITHUB_WRITE_READINESS_DOCUMENT');
    }

    let client;
    try {
      client = createClient({
        fetchImpl,
        AbortControllerImpl: rootRef?.AbortController,
        setTimeoutImpl: rootRef?.setTimeout?.bind?.(rootRef),
        clearTimeoutImpl: rootRef?.clearTimeout?.bind?.(rootRef),
        timeoutMs
      });
    } catch (error) { throw error; }

    let mounted = false;
    let destroyed = false;
    let card = null;
    let status = null;
    let badge = null;
    let refresh = null;
    let createdCard = false;
    let listenerInstalled = false;
    let request = null;
    let generation = 0;
    let snapshots = null;

    function element(tag, className, text) {
      const node = documentRef.createElement(tag);
      if (className) node.className = className;
      if (text) node.textContent = text;
      return node;
    }

    function resolveExisting(existing) {
      card = existing;
      status = card.querySelector?.(`#${STATUS_ID}`) || card.querySelector?.('.github-write-readiness-summary');
      badge = card.querySelector?.('.github-write-readiness-badge');
      refresh = card.querySelector?.('.github-write-readiness-refresh');
      return Boolean(status && badge && refresh);
    }

    function buildCard() {
      const rail = documentRef.querySelector('.utility-rail');
      if (!rail) return false;
      const existing = documentRef.querySelector(`#${CARD_ID}`);
      if (existing) return resolveExisting(existing);

      card = element('section', 'utility-card github-write-readiness-card');
      card.id = CARD_ID;
      card.setAttribute('aria-labelledby', 'githubWriteReadinessTitle');
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
      boundary.append(element('span', '', 'Onay sınırı'));
      badge = element('strong', 'github-write-readiness-badge', 'Kontrol ediliyor');
      badge.dataset.state = 'unknown';
      boundary.append(badge);
      const rules = element('ul', 'github-write-readiness-rules');
      for (const text of [
        'Branch/commit/PR yazımı yalnız sunucu tarafı approval boundary üzerinden çalışır.',
        'Merge, repo silme ve secret görüntüleme bu kart tarafından başlatılamaz.',
        'Bu kart token, repo allowlist’i veya onay secret’ı göstermez.'
      ]) { const item = element('li', '', text); rules.append(item); }
      card.append(head, status, boundary, rules);
      const scheduleCard = rail.querySelector?.('#scheduleRuntimeCard');
      if (scheduleCard?.nextSibling && typeof rail.insertBefore === 'function') rail.insertBefore(card, scheduleCard.nextSibling);
      else rail.append(card);
      createdCard = true;
      return true;
    }

    function render(health) {
      if (destroyed || !mounted) return false;
      const summary = deriveSummary(health);
      status.textContent = summary.text;
      status.dataset.state = summary.state;
      badge.textContent = !health ? 'Bilinmiyor' : health.githubWriteConfigured ? 'Açık onay gerekli' : 'Kapalı';
      badge.dataset.state = !health ? 'unknown' : health.githubWriteConfigured ? 'ready' : 'off';
      card.setAttribute('aria-busy', 'false');
      return true;
    }

    function isCurrent(localRequest, localGeneration) {
      return mounted && !destroyed && request === localRequest && generation === localGeneration;
    }

    async function load() {
      if (!mounted || destroyed) return null;
      request?.abort?.('github-write-readiness-superseded');
      let localRequest;
      try { localRequest = new rootRef.AbortController(); }
      catch { render(null); return null; }
      request = localRequest;
      const localGeneration = ++generation;
      card.setAttribute('aria-busy', 'true');
      refresh.disabled = true;
      try {
        const health = await client.load({ signal: localRequest.signal });
        if (!isCurrent(localRequest, localGeneration)) return null;
        render(health);
        return health;
      } catch (error) {
        if (!isCurrent(localRequest, localGeneration)) return null;
        if (error?.code === 'GITHUB_WRITE_READINESS_TIMEOUT') render(null);
        else if (error?.code !== 'GITHUB_WRITE_READINESS_CANCELLED') render(null);
        return null;
      } finally {
        if (isCurrent(localRequest, localGeneration)) {
          request = null;
          refresh.disabled = false;
        }
      }
    }

    function release() {
      request?.abort?.('github-write-readiness-release');
      request = null;
      generation += 1;
      if (listenerInstalled) refresh?.removeEventListener?.('click', load);
      listenerInstalled = false;
      if (createdCard) card?.remove?.();
      else if (snapshots) {
        restoreNode(card, snapshots.card);
        restoreNode(status, snapshots.status);
        restoreNode(badge, snapshots.badge);
        restoreNode(refresh, snapshots.refresh);
      }
      if (card) ACTIVE_CARDS.delete(card);
      card = status = badge = refresh = null;
      snapshots = null;
      createdCard = false;
      mounted = false;
    }

    function mount() {
      if (mounted || destroyed || !buildCard() || !card || ACTIVE_CARDS.has(card)) return false;
      snapshots = createdCard ? null : Object.freeze({
        card: snapshotNode(card), status: snapshotNode(status), badge: snapshotNode(badge), refresh: snapshotNode(refresh)
      });
      ACTIVE_CARDS.add(card);
      try {
        card.setAttribute('data-hafize-github-write-readiness-owner', '1');
        refresh.addEventListener('click', load);
        listenerInstalled = true;
        mounted = true;
        void load();
        return true;
      } catch {
        release();
        return false;
      }
    }

    function destroy() {
      if (!mounted || destroyed) return false;
      destroyed = true;
      release();
      return true;
    }

    return Object.freeze({ mount, destroy, load, render, getState: () => Object.freeze({ mounted, destroyed, loading: Boolean(request) }) });
  }

  function mount(options) {
    try { const controller = createController(options); return controller.mount() ? controller : null; }
    catch { return null; }
  }

  return Object.freeze({
    HEALTH_PATH, CARD_ID, STATUS_ID, REQUEST_TIMEOUT_MS,
    normalizeHealth, deriveSummary, createClient, createController, mount
  });
});
