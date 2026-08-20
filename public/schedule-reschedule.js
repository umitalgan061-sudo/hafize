(function exposeHafizeScheduleReschedule(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) { module.exports = api; return; }
  root.HafizeScheduleReschedule = api;
  api.autoMount(root.document, root);
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeScheduleReschedule() {
  'use strict';

  const PATH = '/api/schedules';
  const MAX_SCHEDULE_ID_CHARS = 120;
  const AUTO_MOUNT_TIMEOUT_MS = 10_000;
  const SCHEDULE_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;
  const RESCHEDULED_EVENT = 'hafize:schedule-rescheduled';
  const ACTIVE_LISTS = new WeakSet();

  function normalizeScheduleId(value) {
    if (typeof value !== 'string') return null;
    const id = value.trim();
    if (!id || id.length > MAX_SCHEDULE_ID_CHARS || !SCHEDULE_ID_PATTERN.test(id)) return null;
    return id;
  }

  function schedulePath(scheduleId) {
    const id = normalizeScheduleId(scheduleId);
    return id ? `${PATH}/${encodeURIComponent(id)}` : null;
  }

  function normalizeLocalDateTime(value, nowMs = Date.now()) {
    if (typeof value !== 'string' || !value.trim()) return null;
    const parsed = new Date(value);
    const time = parsed.getTime();
    if (!Number.isFinite(time) || time <= nowMs) return null;
    return parsed.toISOString();
  }

  function localInputValue(iso) {
    const date = new Date(iso);
    if (!Number.isFinite(date.getTime())) return '';
    const offset = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }

  async function readPayload(response) {
    try {
      const value = await response.json();
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch { return {}; }
  }

  function createClient({ fetchImpl = globalThis.fetch } = {}) {
    if (typeof fetchImpl !== 'function') throw new Error('INVALID_SCHEDULE_RESCHEDULE_FETCH');
    return Object.freeze({
      async reschedule(scheduleId, runAt) {
        const path = schedulePath(scheduleId);
        if (!path || typeof runAt !== 'string') {
          return Object.freeze({ ok: false, status: 0, payload: Object.freeze({ error: 'INVALID_RESCHEDULE_REQUEST' }) });
        }
        const response = await fetchImpl(path, {
          method: 'PATCH',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          cache: 'no-store',
          body: JSON.stringify({ runAt })
        });
        return Object.freeze({
          ok: Boolean(response?.ok),
          status: Number(response?.status) || 0,
          payload: Object.freeze(await readPayload(response))
        });
      }
    });
  }

  function ensureStyles(documentRef) {
    if (!documentRef?.head || documentRef.querySelector?.('link[data-hafize-schedule-reschedule-style]')) return false;
    const link = documentRef.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/schedule-reschedule.css';
    link.setAttribute('data-hafize-schedule-reschedule-style', '1');
    documentRef.head.append(link);
    return true;
  }

  function scheduleArticleFor(target) {
    const article = target?.closest?.('.schedule-list-item[data-schedule-id]');
    if (!article || article.dataset?.state !== 'scheduled') return null;
    return normalizeScheduleId(article.dataset.scheduleId) ? article : null;
  }

  function createAction(documentRef, article) {
    if (!article || article.querySelector?.('.schedule-reschedule-action')) return null;
    const wrap = documentRef.createElement('div');
    wrap.className = 'schedule-reschedule-action';
    const toggle = documentRef.createElement('button');
    toggle.type = 'button';
    toggle.className = 'schedule-reschedule-toggle';
    toggle.textContent = 'Zamanı değiştir';
    toggle.setAttribute('aria-expanded', 'false');
    const form = documentRef.createElement('form');
    form.className = 'schedule-reschedule-form';
    form.hidden = true;
    const label = documentRef.createElement('label');
    label.className = 'schedule-reschedule-label';
    const labelText = documentRef.createElement('span');
    labelText.textContent = 'Yeni çalışma zamanı';
    const input = documentRef.createElement('input');
    input.type = 'datetime-local';
    input.required = true;
    input.className = 'schedule-reschedule-input';
    label.append(labelText, input);
    const actions = documentRef.createElement('div');
    actions.className = 'schedule-reschedule-form-actions';
    const save = documentRef.createElement('button');
    save.type = 'submit';
    save.className = 'schedule-reschedule-save';
    save.textContent = 'Yeni zamanı kaydet';
    const close = documentRef.createElement('button');
    close.type = 'button';
    close.className = 'schedule-reschedule-close';
    close.textContent = 'Vazgeç';
    actions.append(save, close);
    const status = documentRef.createElement('span');
    status.className = 'schedule-reschedule-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.hidden = true;
    form.append(label, actions, status);
    wrap.append(toggle, form);
    article.append(wrap);
    return { wrap, toggle, form, input, save, close, status };
  }

  function mount(documentRef, root, { fetchImpl = root?.fetch, confirmImpl = root?.confirm?.bind?.(root), now = () => Date.now() } = {}) {
    if (!documentRef || !root || typeof confirmImpl !== 'function' || typeof now !== 'function') return null;
    const card = documentRef.querySelector?.('#scheduleListCard');
    const list = card?.querySelector?.('.schedule-list-items');
    const marker = card?.getAttribute?.('data-hafize-schedule-reschedule-mounted');
    if (!card || !list || ACTIVE_LISTS.has(list) || (marker !== null && marker !== undefined)) return null;
    let client;
    try { client = createClient({ fetchImpl }); } catch { return null; }

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

    function ownedStyle() {
      if (!createdStyle) return null;
      return documentRef.querySelector?.('link[data-hafize-schedule-reschedule-style="1"]') || null;
    }
    function removeOwnedStyle() {
      ownedStyle()?.remove?.();
      createdStyle = false;
    }
    function removeOwnedMarker() {
      if (!markerInstalled) return;
      if (card.getAttribute?.('data-hafize-schedule-reschedule-mounted') === '1') {
        card.removeAttribute?.('data-hafize-schedule-reschedule-mounted');
      }
      markerInstalled = false;
    }
    function removeOwnedActions() {
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
      if (value) nodes.input.focus?.();
    }
    function setBusy(nodes, busy) {
      nodes.wrap.setAttribute('aria-busy', String(Boolean(busy)));
      nodes.toggle.disabled = Boolean(busy);
      nodes.input.disabled = Boolean(busy);
      nodes.save.disabled = Boolean(busy);
      nodes.close.disabled = Boolean(busy);
    }
    function cleanRemoved() {
      for (const [id, nodes] of nodesById.entries()) {
        if (!nodes.wrap?.isConnected) { nodesById.delete(id); busyIds.delete(id); }
      }
    }
    function decorateArticle(article) {
      if (!article || article.dataset?.state !== 'scheduled') return false;
      const id = normalizeScheduleId(article.dataset?.scheduleId);
      if (!id || article.querySelector?.('.schedule-reschedule-action')) return false;
      const nodes = createAction(documentRef, article);
      if (!nodes) return false;
      nodes.toggle.dataset.scheduleId = id;
      nodes.form.dataset.scheduleId = id;
      const meta = article.querySelector?.('.schedule-list-meta');
      nodes.input.value = localInputValue(meta?.dataset?.runAt || '');
      nodesById.set(id, nodes);
      return true;
    }
    function decorateAll() {
      if (destroyed) return;
      cleanRemoved();
      for (const article of list.querySelectorAll?.('.schedule-list-item[data-schedule-id]') || []) {
        if (article.dataset?.state === 'scheduled') decorateArticle(article);
      }
    }

    async function submit(article, id, nodes) {
      if (destroyed || busyIds.has(id) || article.dataset?.state !== 'scheduled') return false;
      const runAt = normalizeLocalDateTime(nodes.input.value, now());
      if (!runAt) { showStatus(nodes, 'Gelecekte geçerli bir çalışma zamanı seç.', 'error'); return false; }
      if (!confirmImpl('Bu görevin çalışma zamanı değiştirilsin mi?')) return false;
      busyIds.add(id);
      setBusy(nodes, true);
      showStatus(nodes, 'Yeni zaman kaydediliyor…', 'loading');
      try {
        const result = await client.reschedule(id, runAt);
        if (destroyed || !nodes.wrap?.isConnected) return false;
        if (result.status === 401) { showStatus(nodes, 'Değişiklik için güvenli cloud oturumu gerekli.', 'auth'); return false; }
        if (result.status === 404) { showStatus(nodes, 'Görev artık bulunamıyor; listeyi yenile.', 'error'); return false; }
        if (result.status === 409) { showStatus(nodes, 'Görev artık yeniden zamanlanabilir durumda değil.', 'error'); return false; }
        if (result.status === 400) { showStatus(nodes, 'Yeni çalışma zamanı kabul edilmedi.', 'error'); return false; }
        if (!result.ok || result.payload?.ok !== true) { showStatus(nodes, 'Görev zamanı değiştirilemedi.', 'error'); return false; }
        showStatus(nodes, 'Görev zamanı güncellendi.', 'success');
        setOpen(nodes, false);
        root.dispatchEvent?.(new root.CustomEvent(RESCHEDULED_EVENT, { detail: Object.freeze({ scheduleId: id }) }));
        return true;
      } catch {
        if (!destroyed && nodes.wrap?.isConnected) showStatus(nodes, 'Görev servisine ulaşılamadı.', 'error');
        return false;
      } finally {
        busyIds.delete(id);
        if (!destroyed && nodes.wrap?.isConnected) setBusy(nodes, false);
      }
    }

    function onClick(event) {
      const toggle = event?.target?.closest?.('.schedule-reschedule-toggle');
      if (toggle && list.contains?.(toggle)) {
        event.preventDefault?.();
        const article = scheduleArticleFor(toggle);
        const id = normalizeScheduleId(toggle.dataset?.scheduleId);
        const nodes = id ? nodesById.get(id) : null;
        if (!article || !nodes || nodes.toggle !== toggle) return;
        clearStatus(nodes);
        setOpen(nodes, nodes.form.hidden);
        return;
      }
      const close = event?.target?.closest?.('.schedule-reschedule-close');
      if (!close || !list.contains?.(close)) return;
      event.preventDefault?.();
      const article = scheduleArticleFor(close);
      const id = normalizeScheduleId(article?.dataset?.scheduleId);
      const nodes = id ? nodesById.get(id) : null;
      if (nodes?.close === close && !busyIds.has(id)) { clearStatus(nodes); setOpen(nodes, false); }
    }
    function onSubmit(event) {
      const form = event?.target?.closest?.('.schedule-reschedule-form');
      if (!form || !list.contains?.(form)) return;
      event.preventDefault?.();
      const article = scheduleArticleFor(form);
      const id = normalizeScheduleId(form.dataset?.scheduleId);
      const nodes = id ? nodesById.get(id) : null;
      if (!article || !nodes || nodes.form !== form) return;
      void submit(article, id, nodes);
    }
    function onEscape(event) {
      if (event?.key !== 'Escape') return;
      for (const [id, nodes] of nodesById.entries()) {
        if (!nodes.form.hidden && !busyIds.has(id)) { event.preventDefault?.(); setOpen(nodes, false); nodes.toggle.focus?.(); break; }
      }
    }

    try {
      createdStyle = ensureStyles(documentRef);
      card.setAttribute('data-hafize-schedule-reschedule-mounted', '1');
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
      getState: () => Object.freeze({ busy: busyIds.size, mountedActions: nodesById.size }),
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
    if (!documentRef.body || typeof root.MutationObserver !== 'function') return null;
    let stopped = false;
    const observer = new root.MutationObserver(() => {
      if (stopped || controller) return;
      controller = mount(documentRef, root, options);
      if (controller) stopWaiting();
    });
    let timeoutId = null;
    function stopWaiting() {
      if (stopped) return;
      stopped = true;
      observer.disconnect?.();
      if (timeoutId !== null) root.clearTimeout?.(timeoutId);
      timeoutId = null;
    }
    observer.observe(documentRef.body, { childList: true, subtree: true });
    timeoutId = root.setTimeout?.(stopWaiting, AUTO_MOUNT_TIMEOUT_MS) ?? null;
    return Object.freeze({
      getController: () => controller,
      destroy() { stopWaiting(); return controller?.destroy?.() ?? true; }
    });
  }

  return Object.freeze({
    PATH, MAX_SCHEDULE_ID_CHARS, AUTO_MOUNT_TIMEOUT_MS, SCHEDULE_ID_PATTERN, RESCHEDULED_EVENT,
    normalizeScheduleId, schedulePath, normalizeLocalDateTime, localInputValue, createClient,
    scheduleArticleFor, mount, autoMount
  });
});
