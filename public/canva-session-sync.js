(function exposeHafizeCanvaSessionSync(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) { module.exports = api; return; }
  root.HafizeCanvaSessionSync = api;
  api.mount(root.document, root);
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeCanvaSessionSync() {
  'use strict';

  const STABLE_STATES = Object.freeze(new Set(['active', 'idle', 'disabled', 'error']));

  function normalizeState(value) {
    return typeof value === 'string' && STABLE_STATES.has(value) ? value : null;
  }

  function mount(documentRef, root) {
    if (!documentRef || typeof documentRef.querySelector !== 'function') return null;
    if (typeof root?.MutationObserver !== 'function') return null;
    const badge = documentRef.querySelector('#sessionBadge');
    if (!badge) return null;

    let lastState = normalizeState(badge.dataset?.state);
    let destroyed = false;
    let observer = null;
    let generation = 1;

    function refreshCanva() {
      if (destroyed) return false;
      const button = documentRef.querySelector('#canvaConnectionCard .canva-connection-refresh');
      if (!button || button.disabled || typeof button.click !== 'function') return false;
      try {
        button.click();
        return true;
      } catch {
        return false;
      }
    }

    function sync() {
      if (destroyed) return false;
      const nextState = normalizeState(badge.dataset?.state);
      if (!nextState || nextState === lastState) return false;
      if (!refreshCanva()) return false;
      lastState = nextState;
      return true;
    }

    const mountedGeneration = generation;
    try {
      observer = new root.MutationObserver(() => {
        if (destroyed || generation !== mountedGeneration) return;
        sync();
      });
      observer.observe(badge, { attributes: true, attributeFilter: ['data-state'] });
    } catch {
      try { observer?.disconnect?.(); } catch {}
      destroyed = true;
      generation += 1;
      return null;
    }

    return Object.freeze({
      sync,
      getState: () => lastState,
      destroy() {
        if (destroyed) return false;
        destroyed = true;
        generation += 1;
        observer.disconnect();
        observer = null;
        return true;
      }
    });
  }

  return Object.freeze({ STABLE_STATES, normalizeState, mount });
});
