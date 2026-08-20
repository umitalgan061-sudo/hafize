(function exposeHafizeScheduleRetryPolicy(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) { module.exports = api; return; }
  root.HafizeScheduleRetryPolicy = api;
  api.autoMount(root.document, root);
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeScheduleRetryPolicy() {
  'use strict';

  const PATH = '/api/schedules';
  const MAX_SCHEDULE_ID_CHARS = 120;
  const AUTO_MOUNT_TIMEOUT_MS = 10_000;
  const REQUEST_TIMEOUT_MS = 30_000;
  const SCHEDULE_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;
  const RESCHEDULED_EVENT = 'hafize:schedule-rescheduled';
  const ACTIVE_LISTS = new WeakSet();
  const RETRY_OPTIONS = Object.freeze([
    Object.freeze({ value: 60_000, label: '1 dakika' }),
    Object.freeze({ value: 300_000, label: '5 dakika' }),
    Object.freeze({ value: 900_000, label: '15 dakika' }),
    Object.freeze({ value: 3_600_000, label: '1 saat' }),
    Object.freeze({ value: 21_600_000, label: '6 saat' }),
    Object.freeze({ value: 86_400_000, label: '24 saat' })
  ]);
  const ALLOWED_RETRY_DELAYS = new Set(RETRY_OPTIONS.map((item) => item.value));

  function normalizeScheduleId(value) {
    if (typeof value !== 'string') return null;
    const id = value.trim();
    if (!id || id.length > MAX_SCHEDULE_ID_CHARS || !SCHEDULE_ID_PATTERN.test(id)) return null;
    return id;
  }

  function normalizeRetryDelay(value) {
    const numeric = typeof value === 'string' && value.trim() ? Number(value) : value;
    return Number.isSafeInteger(numeric) && ALLOWED_RETRY_DELAYS.has(numeric) ? numeric : null;
  }

  function schedulePath(scheduleId) {
    const id = normalizeScheduleId(scheduleId);
    return id ? `${PATH}/${encodeURIComponent(id)}` : null;
  }

  function maxAttemptsFor(article) {
    const value = Number(article?.dataset?.maxAttempts);
    return Number.isInteger(value) && value >= 1 && value <= 5 ? value : null;
  }

  function isEligibleArticle(article) {
    return Boolean(
      article
      && article.dataset?.state === 'scheduled'
      && normalizeScheduleId(article.dataset?.scheduleId)
      && maxAttemptsFor(article) > 1
    );
  }

  async function readPayload(response) {
    try {
      const value = await response.json();
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch { return {}; }
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
    if (typeof fetchImpl !== 'function') throw new Error('INVALID_SCHEDULE_RETRY_POLICY_FETCH');
    if (typeof AbortControllerImpl !== 'function') throw new Error('INVALID_SCHEDULE_RETRY_POLICY_ABORT_CONTROLLER');
    if (typeof setTimeoutImpl !== 'function' || typeof clearTimeoutImpl !== 'function') throw new Error('INVALID_SCHEDULE_RETRY_POLICY_TIMER');
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) throw new Error('INVALID_SCHEDULE_RETRY_POLICY_TIMEOUT');
    return Object.freeze({
      async update(scheduleId, retryDelayMs, { signal } = {}) {
        const path = schedulePath(scheduleId);
        const delay = normalizeRetryDelay(retryDelayMs);
        if (!path || delay == null) {
          return Object.freeze({ ok: false, status: 0, payload: Object.freeze({ error: 'INVALID_RETRY_POLICY_REQUEST' }) });
        }
        if (signal != null && (typeof signal !== 'object' || typeof signal.addEventListener !== 'function')) {
          throw new Error('INVALID_SCHEDULE_RETRY_POLICY_SIGNAL');
        }
        if (signal?.aborted) throw requestError('SCHEDULE_RETRY_POLICY_CANCELLED');

        const controller = new AbortControllerImpl();
        let timedOut = false;
        const onAbort = () => controller.abort(signal?.reason);
        signal?.addEventListener?.('abort', onAbort, { once: true });
        const timer = setTimeoutImpl(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs);

        try {
          const response = await fetchImpl(path, {
            method: 'PATCH',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            cache: 'no-store',
            body: JSON.stringify({ retryDelayMs: delay }),
            signal: controller.signal
          });
          return Object.freeze({
            ok: Boolean(response?.ok),
            status: Number(response?.status) || 0,
            payload: Object.freeze(await readPayload(response))
          });
        } catch (error) {
          if (timedOut) throw requestError('SCHEDULE_RETRY_POLICY_TIMEOUT');
          if (signal?.aborted) throw requestError('SCHEDULE_RETRY_POLICY_CANCELLED');
          throw error;
        } finally {
          clearTimeoutImpl(timer);
          signal?.removeEventListener?.('abort', onAbort);
        }
      }
    });
  }

  function ensureStyles(documentRef) {
    if (!documentRef?.head || documentRef.querySelector?.('link[data-hafize-schedule-retry-policy-style]')) return false;
    const link = documentRef.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/schedule-retry-policy.css';
    link.setAttribute('data-hafize-schedule-retry-policy-style', '1');
    documentRef.head.append(link);
    return true;
  }

  function createAction(documentRef, article) {
    if (!isEligibleArticle(article) || article.querySelector?.('.schedule-retry-policy-action')) return null;
    const wrap = documentRef.createElement('div');
    wrap.className = 'schedule-retry-policy-action';

    const toggle = documentRef.createElement('button');
    toggle.type = 'button';
    toggle.className = 'schedule-retry-policy-toggle';
    toggle.textContent = 'Yeniden deneme aralığı';
    toggle.setAttribute('aria-expanded', 'false');

    const form = documentRef.createElement('form');
    form.className = 'schedule-retry-policy-form';
    form.hidden = true;

    const label = documentRef.createElement('label');
    label.className = 'schedule-retry-policy-label';
    const labelText = documentRef.createElement('span');
    labelText.textContent = 'Başarısız denemeden sonra bekle';
    const select = documentRef.createElement('select');
    select.className = 'schedule-retry-policy-select';
    select.setAttribute('aria-label', 'Yeniden deneme gecikmesi');
    for (const option of RETRY_OPTIONS) select.append(new Option(option.label, String(option.value)));
    label.append(labelText, select);

    const note = documentRef.createElement('p');
    note.className = 'schedule-retry-policy-note';
    note.textContent = `Bu görev en fazla ${maxAttemptsFor(article)} deneme yapacak.`;

    const actions = documentRef.createElement('div');
    actions.className = 'schedule-retry-policy-form-actions';
    const save = documentRef.createElement('button');
    save.type = 'submit';
    save.className = 'schedule-retry-policy-save';
    save.textContent = 'Aralığı kaydet';
    const close = documentRef.createElement('button');
    close.type = 'button';
    close.className = 'schedule-retry-policy-close';
    close.textContent = 'Vazgeç';
    actions.append(save, close);

    const status = documentRef.createElement('span');
    status.className = 'schedule-retry-policy-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.hidden = true;

    form.append(label, note, actions, status);
    wrap.append(toggle, form);
    article.append(wrap);
    return { wrap, toggle, form, select, save, close, status };
  }

  function mount(documentRef, root, { fetchImpl = root?.fetch, confirmImpl = root?.confirm?.bind?.(root), timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
    if (!documentRef || !root || typeof confirmImpl !== 'function') return null;
    const card = documentRef.querySelector?.('#scheduleListCard');
    const list = card?.querySelector?.('.schedule-list-items');
    const marker = card?.getAttribute?.('data-hafize-schedule-retry-policy-mounted');
    if (!card || !list || ACTIVE_LISTS.has(list) || (marker !== null && marker !== undefined)) return null;
    let client;
    try {
      client = createClient({
        fetchImpl,
        AbortControllerImpl: root.AbortController,
        setTimeoutImpl: root.setTimeout?.bind?.(root),
        clearTimeoutImpl: root.clearTimeout?.bind?.(root),
        timeoutMs
      });
    } catch { return null; }

    ACTIVE_LISTS.add(list);
    let createdStyle = false;
    let markerInstalled = false;
    let clickListenerInstalled = false;
    let submitListenerInstalled = false;
    let keyListenerInstalled = false;
    let observer = null;
    let destroyed = false;
    const nodesById = new Map();
    const busyIds = new Set();
    const activeRequests = new Map();

    function ownedStyle() {
      if (!createdStyle) return null;
      return documentRef.querySelector?.('link[data-hafize-schedule-retry-policy-style="1"]') || null;
    }
    function removeOwnedStyle() {
      ownedStyle()?.remove?.();
      createdStyle = false;
    }
    function removeOwnedMarker() {
      if (!markerInstalled) return;
      if (card.getAttribute?.('data-hafize-schedule-retry-policy-mounted') === '1') {
        card.removeAttribute?.('data-hafize-schedule-retry-policy-mounted');
      }
      markerInstalled = false;
    }
    function abortActiveRequests() {
      for (const request of activeRequests.values()) request.abort?.('schedule-retry-policy-release');
      activeRequests.clear();
    }
    function removeOwnedActions() {
      abortActiveRequests();
      for (const nodes of nodesById.values()) nodes.wrap?.remove?.();
      nodesById.clear();
      busyIds.clear();
    }
    function releaseInstallation() {
      observer?.disconnect?.();
      observer = null;
      if (clickListenerInstalled) {
        list.removeEventListener?.('click', onClick);
        clickListenerInstalled = false;
      }
      if (submitListenerInstalled) {
        list.removeEventListener?.('submit', onSubmit);
        submitListenerInstalled = false;
      }
      if (keyListenerInstalled) {
        documentRef.removeEventListener?.('keydown', onEscape);
        keyListenerInstalled = false;
      }
      removeOwnedActions();
      removeOwnedMarker();
      removeOwnedStyle();
      ACTIVE_LISTS.delete(list);
    }

    function showStatus(nodes, text, state) {
      nodes.status.hidden = false;
      nodes.status.textContent = text;
      nodes.status.dataset.state = state;
    }

    function clearStatus(nodes) {
      nodes.status.hidden = true;
      nodes.status.textContent = '';
      delete nodes.status.dataset.state;
    }

    function setOpen(nodes, open) {
      const value = Boolean(open);
      nodes.form.hidden = !value;
      nodes.toggle.setAttribute('aria-expanded', String(value));
      if (value) nodes.select.focus?.();
    }

    function setBusy(nodes, busy) {
      const value = Boolean(busy);
      nodes.wrap.setAttribute('aria-busy', String(value));
      nodes.toggle.disabled = value;
      nodes.select.disabled = value;
      nodes.save.disabled = value;
      nodes.close.disabled = value;
    }

    function cleanRemoved() {
      for (const [id, nodes] of nodesById.entries()) {
        if (!nodes.wrap?.isConnected) {
          activeRequests.get(id)?.abort?.('schedule-retry-policy-action-removed');
          activeRequests.delete(id);
          nodesById.delete(id);
          busyIds.delete(id);
        }
      }
    }

    function decorateArticle(article) {
      if (!isEligibleArticle(article)) return false;
      const id = normalizeScheduleId(article.dataset.scheduleId);
      if (!id || article.querySelector?.('.schedule-retry-policy-action')) return false;
      const nodes = createAction(documentRef, article);
      if (!nodes) return false;
      nodes.toggle.dataset.scheduleId = id;
      nodes.form.dataset.scheduleId = id;
      nodesById.set(id, nodes);
      return true;
    }

    function decorateAll() {
      if (destroyed) return;
      cleanRemoved();
      for (const article of list.querySelectorAll?.('.schedule-list-item[data-schedule-id]') || []) decorateArticle(article);
    }

    function requestIsCurrent(article, id, nodes, request) {
      return !destroyed
        && activeRequests.get(id) === request
        && nodesById.get(id) === nodes
        && nodes.wrap?.isConnected
        && normalizeScheduleId(article?.dataset?.scheduleId) === id;
    }

    async function submit(article, id, nodes) {
      if (destroyed || busyIds.has(id) || activeRequests.has(id) || !isEligibleArticle(article)) return false;
      const retryDelayMs = normalizeRetryDelay(nodes.select.value);
      if (retryDelayMs == null) {
        showStatus(nodes, 'Geçerli bir yeniden deneme aralığı seç.', 'error');
        return false;
      }
      const selected = RETRY_OPTIONS.find((item) => item.value === retryDelayMs);
      if (!confirmImpl(`Bu görev başarısız olursa ${selected?.label || 'seçilen süre'} sonra yeniden denensin mi?`)) return false;

      let request;
      try { request = new root.AbortController(); }
      catch {
        showStatus(nodes, 'Görev servisi isteği başlatılamadı.', 'error');
        return false;
      }
      activeRequests.set(id, request);
      busyIds.add(id);
      setBusy(nodes, true);
      showStatus(nodes, 'Yeniden deneme aralığı kaydediliyor…', 'loading');
      try {
        const result = await client.update(id, retryDelayMs, { signal: request.signal });
        if (!requestIsCurrent(article, id, nodes, request)) return false;
        if (result.status === 401) { showStatus(nodes, 'Değişiklik için güvenli cloud oturumu gerekli.', 'auth'); return false; }
        if (result.status === 404) { showStatus(nodes, 'Görev artık bulunamıyor; listeyi yenile.', 'error'); return false; }
        if (result.status === 409) { showStatus(nodes, 'Görev artık düzenlenebilir durumda değil.', 'error'); return false; }
        if (result.status === 400) { showStatus(nodes, 'Yeniden deneme aralığı kabul edilmedi.', 'error'); return false; }
        if (!result.ok || result.payload?.ok !== true) { showStatus(nodes, 'Yeniden deneme aralığı değiştirilemedi.', 'error'); return false; }
        showStatus(nodes, 'Yeniden deneme aralığı güncellendi.', 'success');
        setOpen(nodes, false);
        root.dispatchEvent?.(new root.CustomEvent(RESCHEDULED_EVENT, { detail: Object.freeze({ scheduleId: id, field: 'retryDelayMs' }) }));
        return true;
      } catch (error) {
        if (!requestIsCurrent(article, id, nodes, request)) return false;
        if (error?.code === 'SCHEDULE_RETRY_POLICY_TIMEOUT') {
          showStatus(nodes, 'Yeniden deneme aralığı isteği zaman aşımına uğradı. Tekrar deneyebilirsin.', 'error');
        } else if (error?.code !== 'SCHEDULE_RETRY_POLICY_CANCELLED') {
          showStatus(nodes, 'Görev servisine ulaşılamadı.', 'error');
        }
        return false;
      } finally {
        if (activeRequests.get(id) === request) activeRequests.delete(id);
        busyIds.delete(id);
        if (!destroyed && !activeRequests.has(id) && nodes.wrap?.isConnected) setBusy(nodes, false);
      }
    }

    function onClick(event) {
      const toggle = event?.target?.closest?.('.schedule-retry-policy-toggle');
      if (toggle && list.contains?.(toggle)) {
        event.preventDefault?.();
        const article = toggle.closest?.('.schedule-list-item[data-schedule-id]');
        const id = normalizeScheduleId(toggle.dataset?.scheduleId);
        const nodes = id ? nodesById.get(id) : null;
        if (!isEligibleArticle(article) || !nodes || nodes.toggle !== toggle) return;
        clearStatus(nodes);
        setOpen(nodes, nodes.form.hidden);
        return;
      }
      const close = event?.target?.closest?.('.schedule-retry-policy-close');
      if (!close || !list.contains?.(close)) return;
      event.preventDefault?.();
      const article = close.closest?.('.schedule-list-item[data-schedule-id]');
      const id = normalizeScheduleId(article?.dataset?.scheduleId);
      const nodes = id ? nodesById.get(id) : null;
      if (nodes?.close === close && !busyIds.has(id)) { clearStatus(nodes); setOpen(nodes, false); }
    }

    function onSubmit(event) {
      const form = event?.target?.closest?.('.schedule-retry-policy-form');
      if (!form || !list.contains?.(form)) return;
      event.preventDefault?.();
      const article = form.closest?.('.schedule-list-item[data-schedule-id]');
      const id = normalizeScheduleId(form.dataset?.scheduleId);
      const nodes = id ? nodesById.get(id) : null;
      if (!isEligibleArticle(article) || !nodes || nodes.form !== form) return;
      void submit(article, id, nodes);
    }

    function onEscape(event) {
      if (event?.key !== 'Escape') return;
      for (const [id, nodes] of nodesById.entries()) {
        if (!nodes.form.hidden && !busyIds.has(id)) {
          event.preventDefault?.();
          setOpen(nodes, false);
          nodes.toggle.focus?.();
          break;
        }
      }
    }

    try {
      createdStyle = ensureStyles(documentRef);
      card.setAttribute('data-hafize-schedule-retry-policy-mounted', '1');
      markerInstalled = true;
      list.addEventListener('click', onClick);
      clickListenerInstalled = true;
      list.addEventListener('submit', onSubmit);
      submitListenerInstalled = true;
      if (typeof documentRef.addEventListener === 'function') {
        documentRef.addEventListener('keydown', onEscape);
        keyListenerInstalled = true;
      }
      observer = typeof root.MutationObserver === 'function' ? new root.MutationObserver(decorateAll) : null;
      observer?.observe(list, { childList: true, subtree: true });
      decorateAll();
    } catch {
      destroyed = true;
      releaseInstallation();
      return null;
    }

    return Object.freeze({
      decorateAll,
      getState: () => Object.freeze({ busy: busyIds.size, mountedActions: nodesById.size, requests: activeRequests.size }),
      destroy() {
        if (destroyed) return false;
        destroyed = true;
        releaseInstallation();
        return true;
      }
    });
  }

  function autoMount(documentRef, root, options = {}) {
    if (!documentRef || !root) return null;
    let controller = mount(documentRef, root, options);
    if (controller) return Object.freeze({ getController: () => controller, destroy: () => controller.destroy() });
    if (!documentRef.body || documentRef.querySelector?.('[data-hafize-schedule-retry-policy-mounted]')) return null;
    if (typeof root.MutationObserver !== 'function') return null;
    let stopped = false;
    let observer;
    try { observer = new root.MutationObserver(() => {
      if (stopped || controller) return;
      controller = mount(documentRef, root, options);
      if (controller) stopWaiting();
    }); } catch { return null; }
    let timeoutId = null;
    function stopWaiting() {
      if (stopped) return;
      stopped = true;
      observer.disconnect?.();
      if (timeoutId !== null) root.clearTimeout?.(timeoutId);
      timeoutId = null;
    }
    try {
      observer.observe(documentRef.body, { childList: true, subtree: true });
      timeoutId = root.setTimeout?.(stopWaiting, AUTO_MOUNT_TIMEOUT_MS) ?? null;
    } catch {
      stopWaiting();
      return null;
    }
    return Object.freeze({
      getController: () => controller,
      destroy() {
        stopWaiting();
        return controller?.destroy?.() ?? true;
      }
    });
  }

  return Object.freeze({
    PATH, MAX_SCHEDULE_ID_CHARS, AUTO_MOUNT_TIMEOUT_MS, REQUEST_TIMEOUT_MS, SCHEDULE_ID_PATTERN, RESCHEDULED_EVENT,
    RETRY_OPTIONS, normalizeScheduleId, normalizeRetryDelay, schedulePath, maxAttemptsFor,
    isEligibleArticle, createClient, mount, autoMount
  });
});
