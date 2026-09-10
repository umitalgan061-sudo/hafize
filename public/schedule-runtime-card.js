(function exposeHafizeScheduleRuntimeCard(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeScheduleRuntimeCard = api;
  const install = () => api.mount(root.document, root);
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeScheduleRuntimeCard() {
  'use strict';

  const HEALTH_PATH = '/api/health';
  const WORKSPACE_EVENT = 'hafize:workspace-changed';
  const TASKS_WORKSPACE = 'tasks';
  const REFRESH_COOLDOWN_MS = 15_000;

  // Yalnız `/api/health` içindeki boolean yapılandırma bayrakları okunur.
  // Model adı, token, subject veya sağlayıcı ayrıntısı bu yüzeye taşınmaz.
  const SIGNALS = Object.freeze([
    Object.freeze({
      key: 'scheduleWorkerConfigured',
      label: 'Görev motoru',
      ready: 'Zamanlanmış ajan görevleri sunucu tarafında yürütülebiliyor.',
      missing: 'NVIDIA anahtarı veya görev yürütme yapılandırması eksik; görevler tetiklenmez.'
    }),
    Object.freeze({
      key: 'scheduleStorageDurable',
      label: 'Kalıcı görev deposu',
      ready: 'Görevler yeniden başlatmadan sonra da korunuyor.',
      missing: 'Görevler yalnız bellekte tutuluyor; sunucu yeniden başlarsa silinir.'
    }),
    Object.freeze({
      key: 'scheduleLeaseConfigured',
      label: 'Çift çalıştırma kilidi',
      ready: 'Redis lease etkin; aynı görev iki kopyada birden çalışmaz.',
      missing: 'Lease yapılandırılmamış; tek kopya çalıştırmaya güvenilmelidir.'
    }),
    Object.freeze({
      key: 'scheduleApiConfigured',
      label: 'Dış worker API',
      ready: 'Dış cron/worker çağrıları ayrı bearer kimliğiyle kabul ediliyor.',
      missing: 'Schedule API kapalı; görevler yalnız uygulama içi worker döngüsüyle çalışır.'
    })
  ]);

  const STATE_COPY = Object.freeze({
    armed: 'Görev motoru tam donanımlı: 7×24 zamanlanmış görevler çalışabilir.',
    partial: 'Görev motoru çalışıyor ancak bazı dayanıklılık ayarları eksik.',
    offline: 'Görev motoru kapalı: zamanlanmış görevler şu anda çalıştırılmaz.',
    unknown: 'Görev motoru durumu alınamadı. Bağlantıyı kontrol edip yeniden dene.'
  });

  const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

  function normalizeHealth(payload) {
    const valid = isPlainObject(payload);
    const signals = SIGNALS.map((signal) => {
      const ready = valid && payload[signal.key] === true;
      return Object.freeze({
        key: signal.key,
        label: signal.label,
        ready,
        detail: ready ? signal.ready : signal.missing
      });
    });
    let state = 'unknown';
    if (valid) {
      const engineReady = signals[0].ready;
      if (!engineReady) state = 'offline';
      else state = signals.every((signal) => signal.ready) ? 'armed' : 'partial';
    }
    return Object.freeze({ state, summary: STATE_COPY[state], signals: Object.freeze(signals) });
  }

  function createController({
    documentRef = globalThis.document,
    rootRef = globalThis,
    fetchImpl,
    now = () => Date.now()
  } = {}) {
    if (!documentRef || typeof documentRef.getElementById !== 'function' || typeof documentRef.createElement !== 'function') {
      throw new Error('INVALID_SCHEDULE_RUNTIME_CARD_DOCUMENT');
    }

    const card = documentRef.getElementById('scheduleRuntimeCard');
    const summary = documentRef.getElementById('scheduleRuntimeState');
    const list = documentRef.getElementById('scheduleRuntimeSignals');
    const refreshButton = documentRef.getElementById('scheduleRuntimeRefresh');
    if (!card || !summary || !list || !refreshButton) throw new Error('SCHEDULE_RUNTIME_CARD_HOST_UNAVAILABLE');

    const fetcher = typeof fetchImpl === 'function'
      ? fetchImpl
      : (typeof rootRef?.fetch === 'function' ? (...args) => rootRef.fetch(...args) : null);

    let mounted = false;
    let destroyed = false;
    let pending = null;
    let loadedAt = 0;
    let view = null;
    const listeners = [];

    function addListener(target, type, handler) {
      if (typeof target?.addEventListener !== 'function' || typeof target?.removeEventListener !== 'function') return false;
      target.addEventListener(type, handler);
      listeners.push(() => target.removeEventListener(type, handler));
      return true;
    }

    function renderSignal(signal) {
      const item = documentRef.createElement('li');
      item.className = `schedule-runtime-signal${signal.ready ? ' ready' : ''}`;

      const dot = documentRef.createElement('span');
      dot.className = 'schedule-runtime-dot';
      dot.setAttribute('aria-hidden', 'true');
      dot.textContent = signal.ready ? '●' : '○';

      const label = documentRef.createElement('strong');
      label.className = 'schedule-runtime-label';
      label.textContent = `${signal.label}: ${signal.ready ? 'hazır' : 'eksik'}`;

      const detail = documentRef.createElement('small');
      detail.className = 'schedule-runtime-detail';
      detail.textContent = signal.detail;

      item.append(dot, label, detail);
      return item;
    }

    function render(next) {
      summary.textContent = next.summary;
      summary.setAttribute('data-state', next.state);
      card.setAttribute('data-state', next.state);
      list.replaceChildren(...next.signals.map((signal) => renderSignal(signal)));
    }

    function setBusy(busy) {
      refreshButton.disabled = busy;
      card.setAttribute('aria-busy', busy ? 'true' : 'false');
    }

    async function load() {
      setBusy(true);
      try {
        const response = await fetcher(HEALTH_PATH, {
          headers: { Accept: 'application/json' },
          credentials: 'same-origin'
        });
        if (!response || response.ok !== true || typeof response.json !== 'function') {
          throw new Error('SCHEDULE_RUNTIME_STATUS_UNAVAILABLE');
        }
        view = normalizeHealth(await response.json());
        loadedAt = now();
      } catch {
        view = normalizeHealth(null);
        loadedAt = 0;
      } finally {
        if (!destroyed) {
          render(view);
          setBusy(false);
        }
        pending = null;
      }
      return view;
    }

    function refresh({ force = false } = {}) {
      if (destroyed) return Promise.resolve(view);
      if (!fetcher) {
        view = normalizeHealth(null);
        render(view);
        return Promise.resolve(view);
      }
      if (pending) return pending;
      if (!force && loadedAt && now() - loadedAt < REFRESH_COOLDOWN_MS) return Promise.resolve(view);
      pending = load();
      return pending;
    }

    function onWorkspaceChanged(event) {
      if (!destroyed && event?.detail?.workspace === TASKS_WORKSPACE) void refresh();
    }

    function onRefreshClick(event) {
      event?.preventDefault?.();
      void refresh({ force: true });
    }

    function mount() {
      if (mounted || destroyed) return false;
      addListener(refreshButton, 'click', onRefreshClick);
      addListener(rootRef, WORKSPACE_EVENT, onWorkspaceChanged);
      mounted = true;
      // Görev çalışma alanı açılmadan ağ isteği yapılmaz; kart yalnız
      // "henüz alınmadı" durumunu gösterir.
      render(normalizeHealth(null));
      return true;
    }

    function destroy() {
      if (!mounted || destroyed) return false;
      destroyed = true;
      while (listeners.length) {
        try { listeners.pop()(); } catch { /* listener zaten kaldırılmış olabilir */ }
      }
      setBusy(false);
      card.removeAttribute?.('data-state');
      mounted = false;
      return true;
    }

    return Object.freeze({ mount, destroy, refresh, getView: () => view });
  }

  function mount(documentRef, rootRef) {
    try {
      const controller = createController({ documentRef, rootRef });
      return controller.mount() ? controller : null;
    } catch {
      return null;
    }
  }

  return Object.freeze({
    HEALTH_PATH,
    WORKSPACE_EVENT,
    REFRESH_COOLDOWN_MS,
    SIGNALS,
    STATE_COPY,
    normalizeHealth,
    createController,
    mount
  });
});
