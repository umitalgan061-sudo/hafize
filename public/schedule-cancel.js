(function exposeHafizeScheduleCancel(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) { module.exports = api; return; }
  root.HafizeScheduleCancel = api;
  api.autoMount(root.document, root);
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeScheduleCancel() {
  'use strict';

  const PATH = '/api/schedules';
  const MAX_SCHEDULE_ID_CHARS = 120;
  const AUTO_MOUNT_TIMEOUT_MS = 10_000;
  const SCHEDULE_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;
  const CANCELLED_EVENT = 'hafize:schedule-cancelled';
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

  async function readPayload(response) {
    try {
      const value = await response.json();
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  }

  function createClient({ fetchImpl = globalThis.fetch } = {}) {
    if (typeof fetchImpl !== 'function') throw new Error('INVALID_SCHEDULE_CANCEL_FETCH');
    return Object.freeze({
      async cancel(scheduleId) {
        const path = schedulePath(scheduleId);
        if (!path) return Object.freeze({ ok: false, status: 0, payload: Object.freeze({ error: 'INVALID_SCHEDULE_ID' }) });
        const response = await fetchImpl(path, {
          method: 'DELETE',
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
          cache: 'no-store'
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
    if (!documentRef?.head || documentRef.querySelector?.('link[data-hafize-schedule-cancel-style]')) return false;
    const link = documentRef.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/schedule-cancel.css';
    link.setAttribute('data-hafize-schedule-cancel-style', '1');
    documentRef.head.append(link);
    return true;
  }

  function scheduleArticleFor(target) {
    if (!target || typeof target.closest !== 'function') return null;
    const article = target.closest('.schedule-list-item[data-schedule-id]');
    if (!article || article.dataset?.state !== 'scheduled') return null;
    return normalizeScheduleId(article.dataset.scheduleId) ? article : null;
  }

  function createAction(documentRef, article) {
    if (!article || article.querySelector?.('.schedule-cancel-action')) return null;
    const row = documentRef.createElement('div');
    row.className = 'schedule-cancel-action';
    const status = documentRef.createElement('span');
    status.className = 'schedule-cancel-inline-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.hidden = true;
    const button = documentRef.createElement('button');
    button.type = 'button';
    button.className = 'schedule-cancel-button';
    button.textContent = 'İptal et';
    button.setAttribute('aria-label', 'Bu zamanlanmış görevi iptal et');
    row.append(status, button);
    article.append(row);
    return { row, status, button };
  }

  function mount(documentRef, root, { fetchImpl = root?.fetch, confirmImpl = root?.confirm?.bind?.(root) } = {}) {
    if (!documentRef || !root || typeof confirmImpl !== 'function') return null;
    const card = documentRef.querySelector?.('#scheduleListCard');
    const list = card?.querySelector?.('.schedule-list-items');
    const marker = card?.getAttribute?.('data-hafize-schedule-cancel-mounted');
    if (!card || !list || ACTIVE_LISTS.has(list) || (marker !== null && marker !== undefined)) return null;
    let client;
    try { client = createClient({ fetchImpl }); } catch { return null; }

    ACTIVE_LISTS.add(list);
    let createdStyle = false;
    let markerInstalled = false;
    let listListenerInstalled = false;
    let rootListenerInstalled = false;
    let observer = null;
    let destroyed = false;
    const busyIds = new Set();
    const actionNodes = new Map();

    function ownedStyle() {
      if (!createdStyle) return null;
      return documentRef.querySelector?.('link[data-hafize-schedule-cancel-style="1"]') || null;
    }
    function removeOwnedStyle() {
      ownedStyle()?.remove?.();
      createdStyle = false;
    }
    function removeOwnedMarker() {
      if (!markerInstalled) return;
      if (card.getAttribute?.('data-hafize-schedule-cancel-mounted') === '1') {
        card.removeAttribute?.('data-hafize-schedule-cancel-mounted');
      }
      markerInstalled = false;
    }
    function removeOwnedActions() {
      for (const nodes of actionNodes.values()) nodes.row?.remove?.();
      actionNodes.clear();
      busyIds.clear();
    }
    function releaseInstallation() {
      observer?.disconnect?.();
      observer = null;
      if (listListenerInstalled) {
        list.removeEventListener?.('click', onClick);
        listListenerInstalled = false;
      }
      if (rootListenerInstalled) {
        root.removeEventListener?.('hafize:schedule-created', onListRefresh);
        rootListenerInstalled = false;
      }
      removeOwnedActions();
      removeOwnedMarker();
      removeOwnedStyle();
      ACTIVE_LISTS.delete(list);
    }

    function showInline(nodes, text, state) {
      if (!nodes?.status) return;
      nodes.status.hidden = false;
      nodes.status.textContent = text;
      nodes.status.dataset.state = state;
    }
    function clearInline(nodes) {
      if (!nodes?.status) return;
      nodes.status.hidden = true;
      nodes.status.textContent = '';
      delete nodes.status.dataset.state;
    }
    function setBusy(nodes, value) {
      if (!nodes) return;
      nodes.button.disabled = Boolean(value);
      nodes.row.setAttribute('aria-busy', String(Boolean(value)));
    }
    function cleanRemovedActions() {
      for (const [id, nodes] of actionNodes.entries()) {
        if (!nodes.row?.isConnected) { actionNodes.delete(id); busyIds.delete(id); }
      }
    }
    function decorateArticle(article) {
      if (!article || article.dataset?.state !== 'scheduled') return false;
      const id = normalizeScheduleId(article.dataset?.scheduleId);
      if (!id || article.querySelector?.('.schedule-cancel-action')) return false;
      const nodes = createAction(documentRef, article);
      if (!nodes) return false;
      nodes.button.dataset.scheduleId = id;
      actionNodes.set(id, nodes);
      return true;
    }
    function decorateAll() {
      if (destroyed) return;
      cleanRemovedActions();
      for (const article of list.querySelectorAll?.('.schedule-list-item[data-schedule-id]') || []) {
        if (article.dataset?.state === 'scheduled') decorateArticle(article);
      }
    }

    async function cancelArticle(article, id, nodes) {
      if (destroyed || busyIds.has(id) || article.dataset?.state !== 'scheduled') return false;
      const confirmed = confirmImpl('Bu zamanlanmış görev iptal edilsin mi? İptal edilen görev çalıştırılmaz.');
      if (!confirmed) return false;
      busyIds.add(id);
      setBusy(nodes, true);
      showInline(nodes, 'İptal ediliyor…', 'loading');
      try {
        const result = await client.cancel(id);
        if (destroyed || !nodes.row?.isConnected) return false;
        if (result.status === 401) { showInline(nodes, 'İptal için güvenli cloud oturumu gerekli.', 'auth'); return false; }
        if (result.status === 404) { showInline(nodes, 'Görev artık bulunamıyor; listeyi yenile.', 'error'); return false; }
        if (result.status === 409) { showInline(nodes, 'Görev artık iptal edilebilir durumda değil.', 'error'); return false; }
        if (!result.ok || result.payload?.ok !== true) { showInline(nodes, 'Görev iptal edilemedi.', 'error'); return false; }
        article.dataset.state = 'cancelled';
        nodes.button.remove?.();
        showInline(nodes, 'Görev iptal edildi.', 'success');
        root.dispatchEvent?.(new root.CustomEvent(CANCELLED_EVENT, { detail: Object.freeze({ scheduleId: id }) }));
        return true;
      } catch {
        if (!destroyed && nodes.row?.isConnected) showInline(nodes, 'Görev servisine ulaşılamadı.', 'error');
        return false;
      } finally {
        busyIds.delete(id);
        if (!destroyed && nodes.row?.isConnected && nodes.button?.isConnected) setBusy(nodes, false);
      }
    }

    function onClick(event) {
      const button = event?.target?.closest?.('.schedule-cancel-button');
      if (!button || !list.contains?.(button)) return;
      event.preventDefault?.();
      const article = scheduleArticleFor(button);
      const id = normalizeScheduleId(button.dataset?.scheduleId);
      if (!article || !id || article.dataset?.scheduleId !== id) return;
      const nodes = actionNodes.get(id);
      if (!nodes || nodes.button !== button) return;
      void cancelArticle(article, id, nodes);
    }
    function onListRefresh() {
      decorateAll();
      for (const nodes of actionNodes.values()) clearInline(nodes);
    }

    try {
      createdStyle = ensureStyles(documentRef);
      card.setAttribute('data-hafize-schedule-cancel-mounted', '1');
      markerInstalled = true;
      list.addEventListener('click', onClick);
      listListenerInstalled = true;
      if (typeof root.addEventListener === 'function') {
        root.addEventListener('hafize:schedule-created', onListRefresh);
        rootListenerInstalled = true;
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
      getState: () => Object.freeze({ busy: busyIds.size, mountedActions: actionNodes.size }),
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
    if (!documentRef.body || documentRef.querySelector?.('[data-hafize-schedule-cancel-mounted]')) return null;
    if (typeof root.MutationObserver !== 'function') return null;
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
      destroy() {
        stopWaiting();
        return controller?.destroy?.() ?? true;
      }
    });
  }

  return Object.freeze({
    PATH, MAX_SCHEDULE_ID_CHARS, AUTO_MOUNT_TIMEOUT_MS, SCHEDULE_ID_PATTERN, CANCELLED_EVENT,
    normalizeScheduleId, schedulePath, createClient, scheduleArticleFor, mount, autoMount
  });
});
