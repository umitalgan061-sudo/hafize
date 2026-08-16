(function exposeHafizeEnhancementsLoader(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }

  root.HafizeEnhancementsLoader = api;
  const start = () => api.loadEnhancements(root.document, root);
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeEnhancementsLoader() {
  'use strict';

  const ENHANCEMENTS = Object.freeze([
    '/message-copy.js',
    '/message-edit.js',
    '/keyboard-shortcuts.js',
    '/conversation-search.js',
    '/scroll-to-latest.js',
    '/composer-limit-feedback.js',
    '/mobile-sidebar-dismiss.js',
    '/draft-clear-undo.js',
    '/draft-navigation-guard.js',
    '/conversation-keyboard-nav.js',
    '/conversation-delete-confirm.js',
    '/shortcut-help.js',
    '/network-status.js',
    '/conversation-copy.js',
    '/in-chat-find.js',
    '/safe-markdown-render.js',
    '/code-block-copy.js',
    '/conversation-export.js',
    '/response-fold.js',
    '/code-block-focus.js',
    '/composer-history.js',
    '/code-block-download.js',
    '/text-file-import.js',
    '/composer-paste-guard.js',
    '/message-timeline.js',
    '/message-keyboard-nav.js'
  ]);

  const LOAD_STATE = Object.freeze({ IDLE: 'idle', LOADING: 'loading', READY: 'ready', FAILED: 'failed' });
  const SCRIPT_MARKER = 'hafizeEnhancementLoader';

  function isAllowedEnhancement(path) {
    return typeof path === 'string' && ENHANCEMENTS.includes(path);
  }

  function normalizeOrigin(root) {
    const origin = root?.location?.origin;
    return typeof origin === 'string' && /^https?:\/\//.test(origin) ? origin : '';
  }

  function resolveAllowedUrl(path, root) {
    if (!isAllowedEnhancement(path)) return '';
    const origin = normalizeOrigin(root);
    if (!origin) return path;
    try {
      const url = new URL(path, origin);
      return url.origin === origin && url.pathname === path && !url.search && !url.hash ? url.href : '';
    } catch {
      return '';
    }
  }

  function scriptSelector(path) {
    const escaped = String(path).replace(/"/g, '\\"');
    return `script[data-${SCRIPT_MARKER.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}="${escaped}"]`;
  }

  function existingScript(documentRef, path) {
    return documentRef?.querySelector?.(scriptSelector(path)) || null;
  }

  function appendScript(documentRef, root, path) {
    if (!documentRef?.createElement || !documentRef?.head || !isAllowedEnhancement(path)) {
      return Promise.reject(new Error('INVALID_ENHANCEMENT_LOADER_INPUT'));
    }

    const existing = existingScript(documentRef, path);
    if (existing) return Promise.resolve(existing);

    const src = resolveAllowedUrl(path, root);
    if (!src) return Promise.reject(new Error('ENHANCEMENT_URL_REJECTED'));

    return new Promise((resolve, reject) => {
      const script = documentRef.createElement('script');
      script.src = src;
      script.defer = true;
      script.dataset[SCRIPT_MARKER] = path;
      script.addEventListener?.('load', () => resolve(script), { once: true });
      script.addEventListener?.('error', () => {
        script.remove?.();
        reject(new Error(`ENHANCEMENT_LOAD_FAILED:${path}`));
      }, { once: true });
      documentRef.head.append(script);
    });
  }

  function createController(documentRef, root, { enhancements = ENHANCEMENTS } = {}) {
    if (!documentRef?.querySelector || !documentRef?.createElement || !documentRef?.head) {
      throw new Error('INVALID_ENHANCEMENT_DOCUMENT');
    }
    if (!Array.isArray(enhancements) || enhancements.some((path) => !isAllowedEnhancement(path))) {
      throw new Error('INVALID_ENHANCEMENT_ALLOWLIST');
    }

    const plan = Object.freeze([...new Set(enhancements)]);
    let state = LOAD_STATE.IDLE;
    let loaded = Object.freeze([]);
    let failedPath = '';
    let inFlight = null;

    async function load() {
      if (state === LOAD_STATE.READY) return snapshot();
      if (inFlight) return inFlight;

      state = LOAD_STATE.LOADING;
      failedPath = '';
      const completed = [];
      inFlight = (async () => {
        try {
          for (const path of plan) {
            await appendScript(documentRef, root, path);
            completed.push(path);
          }
          loaded = Object.freeze(completed);
          state = LOAD_STATE.READY;
          return snapshot();
        } catch (error) {
          loaded = Object.freeze(completed);
          const match = String(error?.message || '').match(/^ENHANCEMENT_LOAD_FAILED:(.+)$/);
          failedPath = match?.[1] || '';
          state = LOAD_STATE.FAILED;
          throw error;
        } finally {
          inFlight = null;
        }
      })();
      return inFlight;
    }

    function snapshot() {
      return Object.freeze({ state, loaded: Object.freeze([...loaded]), failedPath, total: plan.length });
    }

    return Object.freeze({ load, snapshot });
  }

  function loadEnhancements(documentRef, root, options) {
    try {
      const controller = createController(documentRef, root, options);
      controller.load().catch(() => undefined);
      return controller;
    } catch {
      return null;
    }
  }

  return Object.freeze({
    ENHANCEMENTS,
    LOAD_STATE,
    isAllowedEnhancement,
    resolveAllowedUrl,
    appendScript,
    createController,
    loadEnhancements
  });
});
