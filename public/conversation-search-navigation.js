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

  function nextIndex(current, count, direction) {
    if (!Number.isInteger(count) || count <= 0) return -1;
    if (!Number.isInteger(current) || current < 0 || current >= count) return direction < 0 ? count - 1 : 0;
    return (current + (direction < 0 ? -1 : 1) + count) % count;
  }

  function installStyles(documentRef) {
    if (!documentRef?.head || documentRef.getElementById?.(STYLE_ID)) return false;
    const style = documentRef.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLE_TEXT;
    documentRef.head.append(style);
    return true;
  }

  function createNavigation(documentRef, control) {
    const existing = documentRef.getElementById?.(NAV_ID);
    if (existing) return existing;
    const wrapper = documentRef.createElement('div');
    wrapper.id = NAV_ID;
    wrapper.className = 'conversation-search-navigation';

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

    wrapper.append(previous, next, status);
    control.append(wrapper);
    return wrapper;
  }

  function createController({ documentRef = globalThis.document, rootRef = globalThis, MutationObserverImpl = globalThis.MutationObserver } = {}) {
    if (!documentRef?.querySelector) throw new Error('INVALID_CONVERSATION_SEARCH_NAV_DOCUMENT');
    let input = null;
    let list = null;
    let nav = null;
    let previous = null;
    let next = null;
    let status = null;
    let observer = null;
    let current = -1;

    function targets() {
      return hasQuery(input) ? visibleTargets(list) : [];
    }

    function render() {
      const items = targets();
      if (current >= items.length) current = -1;
      const disabled = items.length === 0;
      if (previous) previous.disabled = disabled;
      if (next) next.disabled = disabled;
      if (status) status.textContent = disabled ? '' : current >= 0 ? `${current + 1} / ${items.length}` : `${items.length} eşleşme`;
      return items;
    }

    function move(direction) {
      const items = render();
      if (!items.length) return false;
      current = nextIndex(current, items.length, direction);
      items[current].focus({ preventScroll: false });
      status.textContent = `${current + 1} / ${items.length}`;
      return true;
    }

    function reset() {
      current = -1;
      render();
    }

    function onClick(event) {
      const direction = Number.parseInt(event?.currentTarget?.dataset?.direction || '0', 10);
      if (direction !== 1 && direction !== -1) return;
      event.preventDefault?.();
      move(direction);
    }

    function onKeydown(event) {
      if (!event?.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.repeat) return;
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      if (!hasQuery(input)) return;
      event.preventDefault?.();
      move(event.key === 'ArrowUp' ? -1 : 1);
    }

    function mount() {
      const control = documentRef.querySelector(`#${CONTROL_ID}`);
      input = documentRef.querySelector(`#${INPUT_ID}`);
      list = documentRef.querySelector(`#${LIST_ID}`);
      if (!control || !input || !list) return false;
      installStyles(documentRef);
      nav = createNavigation(documentRef, control);
      previous = nav.querySelector?.('[data-direction="-1"]');
      next = nav.querySelector?.('[data-direction="1"]');
      status = nav.querySelector?.(`#${STATUS_ID}`);
      if (!previous || !next || !status) return false;
      previous.addEventListener('click', onClick);
      next.addEventListener('click', onClick);
      input.addEventListener('input', reset);
      input.addEventListener('keydown', onKeydown);
      if (typeof MutationObserverImpl === 'function') {
        observer = new MutationObserverImpl(reset);
        observer.observe(list, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
      }
      render();
      return true;
    }

    function destroy() {
      previous?.removeEventListener?.('click', onClick);
      next?.removeEventListener?.('click', onClick);
      input?.removeEventListener?.('input', reset);
      input?.removeEventListener?.('keydown', onKeydown);
      observer?.disconnect?.();
      observer = null;
      nav?.remove?.();
      nav = null;
      input = null;
      list = null;
      current = -1;
    }

    return Object.freeze({ mount, destroy, move, reset, render, currentIndex: () => current });
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
    nextIndex,
    installStyles,
    createNavigation,
    createController,
    mount
  });
});
