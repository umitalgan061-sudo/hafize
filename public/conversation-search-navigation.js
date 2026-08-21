(function exposeHafizeConversationSearchNavigation(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) module.exports = api;
  else {
    root.HafizeConversationSearchNavigation = api;
    api.mount({ rootRef: root });
  }
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeConversationSearchNavigation() {
  'use strict';

  const INPUT_ID = 'conversationSearchInput';
  const CONTROL_ID = 'conversationSearchControl';
  const LIST_ID = 'conversationList';
  const NAV_ID = 'conversationSearchNavigation';
  const STATUS_ID = 'conversationSearchNavigationStatus';
  const STYLE_ID = 'hafize-conversation-search-navigation-style';
  const ACTIVE_LISTS = new WeakSet();
  const STYLE_TEXT = `
.conversation-search-navigation{grid-column:1/-1;display:flex;align-items:center;gap:6px}
.conversation-search-navigation button{min-width:44px;min-height:44px;border:1px solid var(--line,#ddd);border-radius:10px;background:transparent;color:inherit;font:inherit;font-size:11px;cursor:pointer}
.conversation-search-navigation button:disabled{opacity:.45;cursor:default}
.conversation-search-navigation button:focus-visible{outline:2px solid var(--accent,#d97706);outline-offset:2px}
.conversation-search-navigation-status{margin-left:auto;color:var(--muted,#777);font-size:10px;line-height:1.35}
@media (forced-colors:active){.conversation-search-navigation button{border-color:CanvasText}}
`;

  function hasQuery(input) {
    return typeof input?.value === 'string' && Boolean(input.value.trim());
  }

  function visibleTargets(list) {
    const rows = Array.from(list?.querySelectorAll?.('.conversation-row') || []);
    return rows
      .filter((row) => row?.hidden !== true)
      .map((row) => row?.querySelector?.('.conversation-open'))
      .filter((button) => button && typeof button.focus === 'function');
  }

  function isKeyboardNavigationTarget(target, input, nav, list) {
    if (!target) return false;
    if (target === input) return true;
    if (typeof nav?.contains === 'function' && nav.contains(target)) return true;
    return visibleTargets(list).includes(target);
  }

  function nextIndex(current, count, direction) {
    if (!Number.isInteger(count) || count <= 0) return -1;
    if (!Number.isInteger(current) || current < 0 || current >= count) return direction < 0 ? count - 1 : 0;
    return (current + (direction < 0 ? -1 : 1) + count) % count;
  }

  function createOwnedStyle(documentRef) {
    if (!documentRef?.head || documentRef.getElementById?.(STYLE_ID)) return null;
    const style = documentRef.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLE_TEXT;
    documentRef.head.append(style);
    return style;
  }

  function createOwnedNavigation(documentRef, control) {
    if (!documentRef?.createElement || !control?.append) return null;
    if (documentRef.getElementById?.(NAV_ID)) return null;
    const wrapper = documentRef.createElement('div');
    wrapper.id = NAV_ID;
    wrapper.className = 'conversation-search-navigation';
    wrapper.setAttribute('data-hafize-owned', 'conversation-search-navigation');

    const previous = documentRef.createElement('button');
    previous.type = 'button';
    previous.dataset.direction = '-1';
    previous.textContent = '↑ Önceki';
    previous.setAttribute('aria-label', 'Önceki eşleşen sohbet');

    const next = documentRef.createElement('button');
    next.type = 'button';
    next.dataset.direction = '1';
    next.textContent = 'Sonraki ↓';
    next.setAttribute('aria-label', 'Sonraki eşleşen sohbet');

    const status = documentRef.createElement('small');
    status.id = STATUS_ID;
    status.className = 'conversation-search-navigation-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');

    wrapper.append(previous, next, status);
    control.append(wrapper);
    return wrapper;
  }

  function createController({
    documentRef = globalThis.document,
    MutationObserverImpl = globalThis.MutationObserver
  } = {}) {
    if (!documentRef?.querySelector || !documentRef?.createElement) {
      throw new Error('INVALID_CONVERSATION_SEARCH_NAV_DOCUMENT');
    }

    let mounted = false;
    let destroyed = false;
    let input = null;
    let list = null;
    let nav = null;
    let previous = null;
    let next = null;
    let status = null;
    let observer = null;
    let ownedStyle = null;
    let ownedNavigation = null;
    let current = -1;
    const cleanup = [];

    function isLive() {
      return !destroyed && mounted && list && ACTIVE_LISTS.has(list);
    }

    function addListener(target, type, listener) {
      if (typeof target?.addEventListener !== 'function' || typeof target?.removeEventListener !== 'function') {
        throw new Error('INVALID_CONVERSATION_SEARCH_NAV_LISTENER_TARGET');
      }
      target.addEventListener(type, listener);
      cleanup.push(() => target.removeEventListener(type, listener));
    }

    function targets() {
      return isLive() && hasQuery(input) ? visibleTargets(list) : [];
    }

    function render() {
      if (!isLive()) return [];
      const items = targets();
      if (current >= items.length) current = -1;
      const disabled = items.length === 0;
      previous.disabled = disabled;
      next.disabled = disabled;
      status.textContent = disabled ? '' : current >= 0 ? `${current + 1} / ${items.length}` : `${items.length} eşleşme`;
      return items;
    }

    function move(direction) {
      if (!isLive() || (direction !== 1 && direction !== -1)) return false;
      const items = render();
      if (!items.length) return false;
      current = nextIndex(current, items.length, direction);
      const target = items[current];
      if (!target || typeof target.focus !== 'function') {
        current = -1;
        render();
        return false;
      }
      try {
        target.focus({ preventScroll: false });
      } catch {
        current = -1;
        render();
        return false;
      }
      if (!isLive()) return false;
      status.textContent = `${current + 1} / ${items.length}`;
      return true;
    }

    function reset() {
      if (!isLive()) return false;
      current = -1;
      render();
      return true;
    }

    function onClick(event) {
      if (!isLive()) return;
      const direction = Number.parseInt(event?.currentTarget?.dataset?.direction || '0', 10);
      if (direction !== 1 && direction !== -1) return;
      event.preventDefault?.();
      move(direction);
    }

    function onKeydown(event) {
      if (!isLive()) return;
      if (!event?.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.repeat) return;
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      if (!hasQuery(input) || !isKeyboardNavigationTarget(event.target, input, nav, list)) return;
      event.preventDefault?.();
      move(event.key === 'ArrowUp' ? -1 : 1);
    }

    function releaseInstallation() {
      observer?.disconnect?.();
      observer = null;
      while (cleanup.length) {
        try { cleanup.pop()?.(); } catch {}
      }
      ownedNavigation?.remove?.();
      ownedNavigation = null;
      ownedStyle?.remove?.();
      ownedStyle = null;
      if (list) ACTIVE_LISTS.delete(list);
      mounted = false;
      current = -1;
    }

    function clearReferences() {
      input = null;
      list = null;
      nav = null;
      previous = null;
      next = null;
      status = null;
    }

    function mount() {
      if (destroyed || mounted) return false;
      const control = documentRef.querySelector(`#${CONTROL_ID}`);
      const candidateInput = documentRef.querySelector(`#${INPUT_ID}`);
      const candidateList = documentRef.querySelector(`#${LIST_ID}`);
      if (!control || !candidateInput || !candidateList) return false;
      if (ACTIVE_LISTS.has(candidateList) || documentRef.getElementById?.(NAV_ID)) return false;

      input = candidateInput;
      list = candidateList;
      ACTIVE_LISTS.add(list);
      try {
        ownedStyle = createOwnedStyle(documentRef);
        ownedNavigation = createOwnedNavigation(documentRef, control);
        if (!ownedNavigation) throw new Error('CONVERSATION_SEARCH_NAV_SURFACE_OWNED');
        nav = ownedNavigation;
        previous = nav.querySelector?.('[data-direction="-1"]');
        next = nav.querySelector?.('[data-direction="1"]');
        status = nav.querySelector?.(`#${STATUS_ID}`);
        if (!previous || !next || !status) throw new Error('INVALID_CONVERSATION_SEARCH_NAV_SURFACE');

        addListener(previous, 'click', onClick);
        addListener(next, 'click', onClick);
        addListener(input, 'input', reset);
        addListener(documentRef, 'keydown', onKeydown);

        if (MutationObserverImpl != null) {
          if (typeof MutationObserverImpl !== 'function') throw new Error('INVALID_CONVERSATION_SEARCH_NAV_OBSERVER');
          observer = new MutationObserverImpl(() => {
            if (isLive()) reset();
          });
          observer.observe(list, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
        }

        mounted = true;
        render();
        return true;
      } catch {
        releaseInstallation();
        clearReferences();
        return false;
      }
    }

    function destroy() {
      if (destroyed) return false;
      destroyed = true;
      releaseInstallation();
      clearReferences();
      return true;
    }

    return Object.freeze({
      mount,
      destroy,
      move,
      reset,
      render,
      currentIndex: () => current,
      isMounted: () => mounted,
      isDestroyed: () => destroyed
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
    INPUT_ID,
    CONTROL_ID,
    LIST_ID,
    NAV_ID,
    STATUS_ID,
    STYLE_ID,
    hasQuery,
    visibleTargets,
    isKeyboardNavigationTarget,
    nextIndex,
    createOwnedStyle,
    createOwnedNavigation,
    createController,
    mount
  });
});