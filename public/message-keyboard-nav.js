(function exposeHafizeMessageKeyboardNav(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) { module.exports = api; return; }
  root.HafizeMessageKeyboardNav = api;
  api.mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeMessageKeyboardNav() {
  'use strict';

  const STYLE_ID = 'hafize-message-keyboard-nav-style';
  const MARKER = 'hafizeMessageNav';
  const SUPPORTED_KEYS = Object.freeze(['ArrowUp', 'ArrowDown', 'Home', 'End']);
  const STYLE_TEXT = `
.message[data-hafize-message-nav="1"]:focus{outline:none}
.message[data-hafize-message-nav="1"]:focus-visible{outline:2px solid var(--accent,#d97706);outline-offset:4px;border-radius:12px}
`;

  function isInteractiveTarget(target) {
    if (!target || typeof target !== 'object') return false;
    const tag = String(target.tagName || '').toLowerCase();
    if (['button', 'a', 'input', 'textarea', 'select', 'summary'].includes(tag)) return true;
    return target.isContentEditable === true || Boolean(target.closest?.('button,a,input,textarea,select,summary,[contenteditable="true"]'));
  }

  function nextIndex(current, key, length) {
    if (!Number.isInteger(current) || !Number.isInteger(length) || length <= 0 || current < 0 || current >= length) return -1;
    if (key === 'Home') return 0;
    if (key === 'End') return length - 1;
    if (key === 'ArrowUp') return Math.max(0, current - 1);
    if (key === 'ArrowDown') return Math.min(length - 1, current + 1);
    return current;
  }

  function visibleMessages(container) {
    return Array.from(container?.querySelectorAll?.('.message[data-message-id]') || []).filter((article) => {
      return !article.hidden && article.getAttribute?.('aria-hidden') !== 'true';
    });
  }

  function installStyles(documentRef) {
    if (!documentRef?.head || documentRef.querySelector?.(`#${STYLE_ID}`)) return false;
    const style = documentRef.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLE_TEXT;
    documentRef.head.append(style);
    return true;
  }

  function createController({
    documentRef = globalThis.document,
    MutationObserverImpl = globalThis.MutationObserver
  } = {}) {
    if (!documentRef?.querySelector || !documentRef?.createElement) throw new Error('INVALID_MESSAGE_KEYBOARD_NAV_DOCUMENT');

    let container = null;
    let observer = null;
    let ownedStyle = null;
    let mounted = false;
    const decorated = new Map();

    function snapshotArticle(article) {
      if (decorated.has(article)) return decorated.get(article);
      const dataset = article.dataset || {};
      const snapshot = Object.freeze({
        hadMarker: Object.prototype.hasOwnProperty.call(dataset, MARKER),
        marker: dataset[MARKER],
        hadTabIndex: Boolean(article.hasAttribute?.('tabindex')),
        tabIndex: article.getAttribute?.('tabindex'),
        hadAriaLabel: Boolean(article.hasAttribute?.('aria-label')),
        ariaLabel: article.getAttribute?.('aria-label')
      });
      decorated.set(article, snapshot);
      return snapshot;
    }

    function restoreArticle(article) {
      const snapshot = decorated.get(article);
      if (!snapshot) return false;
      if (article.dataset) {
        if (snapshot.hadMarker) article.dataset[MARKER] = snapshot.marker;
        else delete article.dataset[MARKER];
      }
      if (snapshot.hadTabIndex) article.setAttribute?.('tabindex', snapshot.tabIndex);
      else article.removeAttribute?.('tabindex');
      if (snapshot.hadAriaLabel) article.setAttribute?.('aria-label', snapshot.ariaLabel);
      else article.removeAttribute?.('aria-label');
      decorated.delete(article);
      return true;
    }

    function restoreAll() {
      for (const article of Array.from(decorated.keys())) restoreArticle(article);
    }

    function decorate() {
      if (!mounted || !container) return 0;
      const messages = visibleMessages(container);
      const visibleSet = new Set(messages);
      for (const article of Array.from(decorated.keys())) {
        if (!visibleSet.has(article)) restoreArticle(article);
      }

      let activeFound = false;
      let count = 0;
      for (const article of messages) {
        snapshotArticle(article);
        if (article.dataset) article.dataset[MARKER] = '1';
        const alreadyActive = article.tabIndex === 0;
        if (alreadyActive && !activeFound) activeFound = true;
        else article.tabIndex = -1;
        if (!article.getAttribute?.('aria-label')) {
          const sender = article.querySelector?.('.meta')?.textContent?.trim() || '';
          article.setAttribute?.('aria-label', sender ? `${sender} mesajı` : 'Sohbet mesajı');
        }
        count += 1;
      }
      if (messages.length && !activeFound) messages[0].tabIndex = 0;
      return count;
    }

    function focusMessage(article) {
      if (!mounted || !article) return false;
      const messages = visibleMessages(container);
      if (!messages.includes(article)) return false;
      for (const item of messages) item.tabIndex = item === article ? 0 : -1;
      article.focus?.({ preventScroll: true });
      article.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      return true;
    }

    function onFocusIn(event) {
      if (!mounted) return false;
      const article = event?.target?.closest?.('.message[data-message-id]');
      if (!article || event.target !== article) return false;
      return focusMessage(article);
    }

    function onKeyDown(event) {
      if (!mounted || !event || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false;
      if (!SUPPORTED_KEYS.includes(event.key) || isInteractiveTarget(event.target)) return false;
      const article = event.target?.closest?.('.message[data-message-id]');
      if (!article || event.target !== article) return false;
      const messages = visibleMessages(container);
      const current = messages.indexOf(article);
      const targetIndex = nextIndex(current, event.key, messages.length);
      if (targetIndex < 0 || targetIndex === current) return false;
      event.preventDefault?.();
      return focusMessage(messages[targetIndex]);
    }

    function onMutations() {
      if (!mounted) return;
      decorate();
    }

    function mount() {
      if (mounted) return true;
      container = documentRef.querySelector('#messages');
      if (!container || typeof container.addEventListener !== 'function') {
        container = null;
        return false;
      }

      const installedStyle = installStyles(documentRef);
      ownedStyle = installedStyle ? documentRef.querySelector(`#${STYLE_ID}`) : null;
      mounted = true;
      try {
        decorate();
        container.addEventListener('keydown', onKeyDown);
        container.addEventListener('focusin', onFocusIn);
        if (typeof MutationObserverImpl === 'function') {
          observer = new MutationObserverImpl(onMutations);
          observer.observe(container, { childList: true, subtree: true });
        }
        return true;
      } catch {
        destroy();
        return false;
      }
    }

    function destroy() {
      if (!mounted) return false;
      mounted = false;
      observer?.disconnect?.();
      observer = null;
      container?.removeEventListener?.('keydown', onKeyDown);
      container?.removeEventListener?.('focusin', onFocusIn);
      restoreAll();
      ownedStyle?.remove?.();
      ownedStyle = null;
      container = null;
      return true;
    }

    function snapshot() {
      return Object.freeze({ mounted, decoratedCount: decorated.size, observing: Boolean(observer), ownsStyle: Boolean(ownedStyle) });
    }

    return Object.freeze({ mount, destroy, decorate, focusMessage, onFocusIn, onKeyDown, snapshot });
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
    STYLE_ID,
    MARKER,
    SUPPORTED_KEYS,
    isInteractiveTarget,
    nextIndex,
    visibleMessages,
    installStyles,
    createController,
    mount
  });
});
