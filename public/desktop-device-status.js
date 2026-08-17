(function exposeHafizeDesktopDeviceStatus(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeDesktopDeviceStatus = api;
  const install = () => api.mount({ root });
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createDesktopDeviceStatusApi() {
  'use strict';

  const CARD_ID = 'desktopDeviceStatusCard';
  const MAX_TEXT = 64;
  const MAX_ACTIONS = 12;
  const ACTION_KINDS = Object.freeze(new Set(['browser', 'app']));

  function cleanText(value) {
    return typeof value === 'string' ? value.trim().slice(0, MAX_TEXT) : '';
  }

  function normalizeSystemInfo(value) {
    if (!value || Array.isArray(value) || typeof value !== 'object') return null;
    const platform = cleanText(value.platform);
    const arch = cleanText(value.arch);
    const appVersion = cleanText(value.appVersion);
    const cpuCount = Number.isInteger(value.cpuCount) && value.cpuCount >= 0 && value.cpuCount <= 512 ? value.cpuCount : 0;
    const totalMemoryMb = Number.isInteger(value.totalMemoryMb) && value.totalMemoryMb >= 0 && value.totalMemoryMb <= 16_777_216
      ? value.totalMemoryMb
      : 0;
    if (!platform && !arch && !appVersion && !cpuCount && !totalMemoryMb) return null;
    return Object.freeze({ platform, arch, appVersion, cpuCount, totalMemoryMb });
  }

  function normalizeBrowserOrigin(value) {
    if (typeof value !== 'string' || !value.trim() || value.length > 2048) return '';
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return '';
      return url.origin;
    } catch {
      return '';
    }
  }

  function normalizeCapabilities(value) {
    if (!value || Array.isArray(value) || typeof value !== 'object') return Object.freeze({ browserOrigins: [], appIds: [] });
    const browserOrigins = Array.isArray(value.browserOrigins)
      ? value.browserOrigins.map(normalizeBrowserOrigin).filter(Boolean).slice(0, MAX_ACTIONS)
      : [];
    const appIds = Array.isArray(value.appIds)
      ? value.appIds.filter((item) => typeof item === 'string' && /^[a-z][a-z0-9._-]{1,63}$/.test(item)).slice(0, MAX_ACTIONS)
      : [];
    return Object.freeze({ browserOrigins: [...new Set(browserOrigins)], appIds: [...new Set(appIds)] });
  }

  function normalizePendingAction(kind, value) {
    if (!ACTION_KINDS.has(kind)) return null;
    if (kind === 'browser') {
      const origin = normalizeBrowserOrigin(value);
      return origin ? Object.freeze({ kind, value: `${origin}/`, label: new URL(origin).hostname }) : null;
    }
    if (typeof value !== 'string' || !/^[a-z][a-z0-9._-]{1,63}$/.test(value)) return null;
    return Object.freeze({ kind, value, label: value });
  }

  function formatMemory(totalMemoryMb) {
    if (!Number.isInteger(totalMemoryMb) || totalMemoryMb <= 0) return '—';
    if (totalMemoryMb >= 1024) return `${(totalMemoryMb / 1024).toFixed(totalMemoryMb >= 10_240 ? 0 : 1)} GB`;
    return `${totalMemoryMb} MB`;
  }

  function createElement(documentRef, tag, className, text) {
    const node = documentRef.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function createController({ root = globalThis, documentRef = root?.document, bridge = root?.hafizeDevice } = {}) {
    if (!documentRef || typeof documentRef.querySelector !== 'function') throw new Error('INVALID_DESKTOP_DEVICE_STATUS_DOCUMENT');
    let card = null;
    let status = null;
    let values = null;
    let launchers = null;
    let review = null;
    let reviewText = null;
    let confirmButton = null;
    let cancelButton = null;
    let refreshButton = null;
    let mounted = false;
    let generation = 0;
    let actionBusy = false;
    let pendingAction = null;

    function hasBridge() {
      return Boolean(
        bridge
        && typeof bridge.getSystemInfo === 'function'
        && typeof bridge.getCapabilities === 'function'
        && typeof bridge.openBrowser === 'function'
        && typeof bridge.openApp === 'function'
      );
    }

    function setBusy(value) {
      card?.setAttribute('aria-busy', value ? 'true' : 'false');
      if (refreshButton) refreshButton.disabled = Boolean(value) || actionBusy;
    }

    function renderInfo(info) {
      const rows = [
        ['Platform', info.platform || '—'],
        ['Mimari', info.arch || '—'],
        ['Hafize', info.appVersion || '—'],
        ['CPU', info.cpuCount ? `${info.cpuCount} çekirdek` : '—'],
        ['Bellek', formatMemory(info.totalMemoryMb)]
      ];
      values.replaceChildren();
      for (const [label, value] of rows) {
        const item = createElement(documentRef, 'div', 'desktop-device-item');
        item.append(
          createElement(documentRef, 'span', 'desktop-device-label', label),
          createElement(documentRef, 'span', 'desktop-device-value', value)
        );
        values.append(item);
      }
      status.textContent = 'Masaüstü cihaz köprüsü hazır. Dış açma işlemleri ayrıca onay ister.';
    }

    function clearPendingAction({ announce = false } = {}) {
      pendingAction = null;
      if (review) review.hidden = true;
      if (reviewText) reviewText.textContent = '';
      if (confirmButton) confirmButton.disabled = true;
      if (announce && status) status.textContent = 'Cihaz eylemi iptal edildi.';
    }

    function onCancel() {
      if (!actionBusy) clearPendingAction({ announce: true });
    }

    function onKeydown(event) {
      if (event?.key !== 'Escape' || !pendingAction || actionBusy) return;
      event.preventDefault?.();
      onCancel();
    }

    function prepareAction(kind, value) {
      if (!mounted || actionBusy) return false;
      const normalized = normalizePendingAction(kind, value);
      if (!normalized) {
        clearPendingAction();
        status.textContent = 'Cihaz eylemi güvenlik sınırına uymuyor.';
        return false;
      }
      pendingAction = normalized;
      reviewText.textContent = normalized.kind === 'browser'
        ? `Tarayıcıda aç: ${normalized.label}`
        : `Uygulamayı aç: ${normalized.label}`;
      review.hidden = false;
      confirmButton.disabled = false;
      confirmButton.textContent = normalized.kind === 'browser' ? 'Onayla ve tarayıcıda aç' : 'Onayla ve uygulamayı aç';
      confirmButton.focus?.();
      status.textContent = 'Hedefi kontrol et ve yalnız istiyorsan onayla.';
      return true;
    }

    async function confirmPendingAction() {
      if (!mounted || actionBusy || !pendingAction) return false;
      const action = pendingAction;
      actionBusy = true;
      confirmButton.disabled = true;
      cancelButton.disabled = true;
      refreshButton.disabled = true;
      status.textContent = action.kind === 'browser' ? 'Tarayıcı açılıyor…' : 'Uygulama açılıyor…';
      try {
        const request = action.kind === 'browser'
          ? bridge.openBrowser(action.value)
          : bridge.openApp(action.value);
        const result = await request;
        if (!mounted) return false;
        status.textContent = result?.ok === true
          ? 'Cihaz eylemi açık kullanıcı onayıyla tamamlandı.'
          : 'Cihaz eylemi güvenlik politikası tarafından reddedildi.';
        return result?.ok === true;
      } catch {
        if (mounted) status.textContent = 'Cihaz eylemi güvenli biçimde tamamlanamadı.';
        return false;
      } finally {
        actionBusy = false;
        if (mounted) {
          cancelButton.disabled = false;
          refreshButton.disabled = false;
          clearPendingAction();
        }
      }
    }

    function renderCapabilities(capabilities) {
      launchers.replaceChildren();
      clearPendingAction();
      for (const origin of capabilities.browserOrigins) {
        const button = createElement(documentRef, 'button', 'mini-btn', new URL(origin).hostname);
        button.type = 'button';
        button.title = `${origin} hedefini incele`;
        button.addEventListener('click', () => prepareAction('browser', origin));
        launchers.append(button);
      }
      for (const appId of capabilities.appIds) {
        const button = createElement(documentRef, 'button', 'mini-btn', `Uygulama · ${appId}`);
        button.type = 'button';
        button.title = `${appId} uygulamasını açmayı incele`;
        button.addEventListener('click', () => prepareAction('app', appId));
        launchers.append(button);
      }
      launchers.hidden = launchers.children.length === 0;
    }

    async function refresh() {
      if (!mounted || !hasBridge() || actionBusy) return false;
      const token = ++generation;
      clearPendingAction();
      setBusy(true);
      status.textContent = 'Cihaz bilgisi okunuyor…';
      try {
        const [infoResult, capabilityResult] = await Promise.all([
          bridge.getSystemInfo(),
          bridge.getCapabilities()
        ]);
        if (!mounted || token !== generation) return false;
        const info = infoResult?.ok === true ? normalizeSystemInfo(infoResult.value) : null;
        if (!info) {
          values.replaceChildren();
          launchers.replaceChildren();
          launchers.hidden = true;
          status.textContent = 'Cihaz bilgisi güvenli köprüden alınamadı.';
          return false;
        }
        renderInfo(info);
        renderCapabilities(capabilityResult?.ok === true ? normalizeCapabilities(capabilityResult.value) : normalizeCapabilities({}));
        return true;
      } catch {
        if (mounted && token === generation) {
          values.replaceChildren();
          launchers.replaceChildren();
          launchers.hidden = true;
          status.textContent = 'Cihaz bilgisi güvenli köprüden alınamadı.';
        }
        return false;
      } finally {
        if (mounted && token === generation) setBusy(false);
      }
    }

    function buildCard() {
      const rail = documentRef.querySelector('.utility-rail');
      if (!rail) return false;
      card = createElement(documentRef, 'section', 'utility-card desktop-device-card');
      card.id = CARD_ID;
      card.setAttribute('aria-labelledby', `${CARD_ID}Title`);
      card.setAttribute('aria-busy', 'false');

      const head = createElement(documentRef, 'div', 'utility-head');
      const title = createElement(documentRef, 'span', '', 'Masaüstü cihaz');
      title.id = `${CARD_ID}Title`;
      head.append(createElement(documentRef, 'span', 'mini-icon', '▰'), title);
      status = createElement(documentRef, 'p', 'desktop-device-state', 'Cihaz köprüsü kontrol ediliyor…');
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      values = createElement(documentRef, 'div', 'desktop-device-grid');
      launchers = createElement(documentRef, 'div', 'desktop-device-launchers');
      launchers.hidden = true;
      launchers.setAttribute('aria-label', 'İzin verilen masaüstü açma hedefleri');

      review = createElement(documentRef, 'div', 'desktop-device-review');
      review.hidden = true;
      review.setAttribute('role', 'group');
      review.setAttribute('aria-label', 'Cihaz eylemi onayı');
      reviewText = createElement(documentRef, 'p', 'desktop-device-review-copy');
      const reviewActions = createElement(documentRef, 'div', 'desktop-device-review-actions');
      confirmButton = createElement(documentRef, 'button', 'mini-btn desktop-device-confirm', 'Onayla');
      confirmButton.type = 'button';
      confirmButton.disabled = true;
      cancelButton = createElement(documentRef, 'button', 'mini-btn', 'Vazgeç');
      cancelButton.type = 'button';
      confirmButton.addEventListener('click', confirmPendingAction);
      cancelButton.addEventListener('click', onCancel);
      reviewActions.append(confirmButton, cancelButton);
      review.append(reviewText, reviewActions);

      const actions = createElement(documentRef, 'div', 'desktop-device-actions');
      refreshButton = createElement(documentRef, 'button', 'mini-btn', 'Yenile');
      refreshButton.type = 'button';
      refreshButton.addEventListener('click', refresh);
      actions.append(refreshButton);
      card.append(head, status, values, launchers, review, actions);
      rail.append(card);
      documentRef.addEventListener?.('keydown', onKeydown);
      return true;
    }

    function mount() {
      if (mounted || !hasBridge()) return false;
      if (!buildCard()) return false;
      mounted = true;
      void refresh();
      return true;
    }

    function destroy() {
      if (!mounted) return false;
      mounted = false;
      generation += 1;
      pendingAction = null;
      documentRef.removeEventListener?.('keydown', onKeydown);
      refreshButton?.removeEventListener('click', refresh);
      confirmButton?.removeEventListener('click', confirmPendingAction);
      cancelButton?.removeEventListener('click', onCancel);
      card?.remove();
      card = status = values = launchers = review = reviewText = confirmButton = cancelButton = refreshButton = null;
      return true;
    }

    return Object.freeze({
      mount,
      destroy,
      refresh,
      hasBridge,
      prepareAction,
      confirmPendingAction,
      getPendingAction: () => pendingAction
    });
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
    CARD_ID,
    MAX_ACTIONS,
    normalizeSystemInfo,
    normalizeBrowserOrigin,
    normalizeCapabilities,
    normalizePendingAction,
    formatMemory,
    createController,
    mount
  });
});
