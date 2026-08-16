(function exposeHafizeDesktopDeviceStatus(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeDesktopDeviceStatus = api;
  api.mount({ root });
})(typeof globalThis !== 'undefined' ? globalThis : self, function createDesktopDeviceStatusApi() {
  'use strict';

  const CARD_ID = 'desktopDeviceStatusCard';
  const STYLE_ID = 'desktopDeviceStatusStyle';
  const MAX_TEXT = 64;
  const MAX_ACTIONS = 12;

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

  function normalizeCapabilities(value) {
    if (!value || Array.isArray(value) || typeof value !== 'object') return Object.freeze({ browserOrigins: [], appIds: [] });
    const browserOrigins = Array.isArray(value.browserOrigins)
      ? value.browserOrigins.filter((item) => typeof item === 'string' && /^https:\/\/[^\s/]+(?::\d+)?$/.test(item)).slice(0, MAX_ACTIONS)
      : [];
    const appIds = Array.isArray(value.appIds)
      ? value.appIds.filter((item) => typeof item === 'string' && /^[a-z][a-z0-9._-]{1,63}$/.test(item)).slice(0, MAX_ACTIONS)
      : [];
    return Object.freeze({ browserOrigins: [...new Set(browserOrigins)], appIds: [...new Set(appIds)] });
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

  function ensureStyle(documentRef) {
    if (documentRef.getElementById(STYLE_ID)) return;
    const style = documentRef.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .desktop-device-card[hidden]{display:none!important}
      .desktop-device-card .desktop-device-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
      .desktop-device-card .desktop-device-item{min-width:0;padding:8px 9px;border:1px solid var(--line,#ded8ce);border-radius:10px;background:color-mix(in srgb,var(--panel,#fff) 82%,transparent)}
      .desktop-device-card .desktop-device-label{display:block;font-size:11px;opacity:.68;margin-bottom:3px}
      .desktop-device-card .desktop-device-value{display:block;font-size:12px;font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .desktop-device-card .desktop-device-state{margin:8px 0 0;font-size:12px;line-height:1.45;opacity:.76}
      .desktop-device-card .desktop-device-actions{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end;margin-top:8px}
      .desktop-device-card .desktop-device-launchers{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;padding-top:10px;border-top:1px solid var(--line,#ded8ce)}
      .desktop-device-card .desktop-device-launchers[hidden]{display:none}
      @media (max-width:520px){.desktop-device-card .desktop-device-grid{grid-template-columns:1fr}.desktop-device-card .desktop-device-launchers button{flex:1 1 100%}}
      @media (prefers-reduced-motion:reduce){.desktop-device-card *{scroll-behavior:auto!important;transition:none!important}}
      @media (forced-colors:active){.desktop-device-card .desktop-device-item,.desktop-device-card .desktop-device-launchers{border-color:CanvasText}}
    `;
    documentRef.head?.append(style);
  }

  function createController({ root = globalThis, documentRef = root?.document, bridge = root?.hafizeDevice } = {}) {
    if (!documentRef || typeof documentRef.querySelector !== 'function') throw new Error('INVALID_DESKTOP_DEVICE_STATUS_DOCUMENT');
    let card = null;
    let status = null;
    let values = null;
    let launchers = null;
    let refreshButton = null;
    let mounted = false;
    let generation = 0;

    function hasBridge() {
      return Boolean(bridge && typeof bridge.getSystemInfo === 'function');
    }

    function setBusy(value) {
      card?.setAttribute('aria-busy', value ? 'true' : 'false');
      if (refreshButton) refreshButton.disabled = Boolean(value);
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
      status.textContent = 'Masaüstü cihaz köprüsü hazır. Dış açma işlemleri yalnız görünür düğme tıklamasıyla çalışır.';
    }

    async function runAction(kind, value) {
      if (!mounted) return false;
      status.textContent = kind === 'browser' ? 'Tarayıcı açılıyor…' : 'Uygulama açılıyor…';
      try {
        const result = kind === 'browser' ? await bridge.openBrowser(value) : await bridge.openApp(value);
        status.textContent = result?.ok === true ? 'İstek cihaz köprüsüne gönderildi.' : 'Cihaz eylemi güvenlik politikası tarafından reddedildi.';
        return result?.ok === true;
      } catch {
        status.textContent = 'Cihaz eylemi güvenli biçimde tamamlanamadı.';
        return false;
      }
    }

    function renderCapabilities(capabilities) {
      launchers.replaceChildren();
      for (const origin of capabilities.browserOrigins) {
        const button = createElement(documentRef, 'button', 'mini-btn', new URL(origin).hostname);
        button.type = 'button';
        button.title = origin;
        button.addEventListener('click', () => runAction('browser', `${origin}/`), { once: false });
        launchers.append(button);
      }
      for (const appId of capabilities.appIds) {
        const button = createElement(documentRef, 'button', 'mini-btn', `Uygulama · ${appId}`);
        button.type = 'button';
        button.addEventListener('click', () => runAction('app', appId), { once: false });
        launchers.append(button);
      }
      launchers.hidden = launchers.children.length === 0;
    }

    async function refresh() {
      if (!mounted || !hasBridge()) return false;
      const token = ++generation;
      setBusy(true);
      status.textContent = 'Cihaz bilgisi okunuyor…';
      try {
        const [infoResult, capabilityResult] = await Promise.all([
          bridge.getSystemInfo(),
          typeof bridge.getCapabilities === 'function' ? bridge.getCapabilities() : Promise.resolve({ ok: true, value: {} })
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
      ensureStyle(documentRef);
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
      launchers.setAttribute('aria-label', 'İzin verilen masaüstü açma eylemleri');
      const actions = createElement(documentRef, 'div', 'desktop-device-actions');
      refreshButton = createElement(documentRef, 'button', 'mini-btn', 'Yenile');
      refreshButton.type = 'button';
      refreshButton.addEventListener('click', refresh);
      actions.append(refreshButton);
      card.append(head, status, values, launchers, actions);
      rail.append(card);
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
      refreshButton?.removeEventListener('click', refresh);
      card?.remove();
      card = status = values = launchers = refreshButton = null;
      return true;
    }

    return Object.freeze({ mount, destroy, refresh, hasBridge, runAction });
  }

  function mount(options) {
    try {
      const controller = createController(options);
      return controller.mount() ? controller : null;
    } catch {
      return null;
    }
  }

  return Object.freeze({ CARD_ID, STYLE_ID, normalizeSystemInfo, normalizeCapabilities, formatMemory, createController, mount });
});
