(function exposeHafizeInChatFind(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeInChatFind = api;
  api.mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeInChatFind() {
  'use strict';

  const MAX_QUERY_CHARS = 120;
  const CONTROL_ID = 'inChatFindControl';
  const ACTIVE_CLASS = 'in-chat-find-match';
  const CURRENT_CLASS = 'in-chat-find-current';
  const STYLE_ID = 'hafize-in-chat-find-style';
  const STYLE_TEXT = `
+.in-chat-find{position:fixed;top:74px;right:18px;z-index:35;display:flex;align-items:center;gap:6px;padding:8px;border:1px solid var(--line,#ddd);border-radius:12px;background:var(--surface,#fff);box-shadow:0 10px 30px rgba(0,0,0,.12)}
+.in-chat-find[hidden]{display:none}
+.in-chat-find input{width:min(220px,48vw);border:1px solid var(--line,#ddd);border-radius:8px;background:transparent;color:inherit;padding:7px 8px;font:inherit;font-size:12px}
+.in-chat-find button{border:1px solid var(--line,#ddd);border-radius:8px;background:transparent;color:inherit;padding:6px 8px;font:inherit;font-size:11px;cursor:pointer}
+.in-chat-find-status{min-width:48px;color:var(--muted,#777);font-size:11px;text-align:center}
+.message.${ACTIVE_CLASS}{outline:1px solid color-mix(in srgb,var(--accent,#d97706) 40%,transparent);outline-offset:3px;border-radius:10px}
+.message.${CURRENT_CLASS}{outline-width:2px}
+`;

  function normalizeQuery(value) {
    if (typeof value !== 'string' || value.length > MAX_QUERY_CHARS) return null;
    return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR');
  }

  function messageText(article) {
    const text = article?.querySelector?.('.content')?.textContent;
    return typeof text === 'string' ? text.replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR') : '';
  }

  function matchingMessages(messages, rawQuery) {
    const query = normalizeQuery(rawQuery);
    if (query === null) return null;
    if (!query) return [];
    return Array.from(messages || []).filter((article) => article?.classList?.contains('message') && messageText(article).includes(query));
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
    windowRef = globalThis,
    MutationObserverImpl = globalThis.MutationObserver
  } = {}) {
    if (!documentRef || typeof documentRef.querySelector !== 'function') throw new Error('INVALID_IN_CHAT_FIND_DOCUMENT');

    let control = null;
    let input = null;
    let status = null;
    let previous = null;
    let next = null;
    let close = null;
    let messages = null;
    let observer = null;
    let matches = [];
    let index = -1;
    let returnFocus = null;

    function allMessages() {
      return messages?.querySelectorAll?.('.message') || [];
    }

    function clearClasses() {
      for (const article of Array.from(allMessages())) {
        article.classList?.remove?.(ACTIVE_CLASS);
        article.classList?.remove?.(CURRENT_CLASS);
      }
    }

    function updateStatus() {
      if (!status) return;
      status.textContent = matches.length && index >= 0 ? `${index + 1}/${matches.length}` : matches.length ? `${matches.length}` : '0/0';
      if (previous) previous.disabled = matches.length === 0;
      if (next) next.disabled = matches.length === 0;
    }

    function focusCurrent({ smooth = false } = {}) {
      clearClasses();
      for (const article of matches) article.classList?.add?.(ACTIVE_CLASS);
      const current = matches[index];
      if (current) {
        current.classList?.add?.(CURRENT_CLASS);
        current.scrollIntoView?.({ block: 'center', behavior: smooth ? 'smooth' : 'auto' });
      }
      updateStatus();
      return current || null;
    }

    function apply() {
      const result = matchingMessages(allMessages(), input?.value || '');
      if (result === null) {
        matches = [];
        index = -1;
        clearClasses();
        if (status) status.textContent = 'Sorgu uzun';
        return false;
      }
      matches = result;
      index = matches.length ? 0 : -1;
      focusCurrent();
      return true;
    }

    function step(delta) {
      if (!matches.length) return false;
      index = (index + delta + matches.length) % matches.length;
      focusCurrent({ smooth: true });
      return true;
    }

    function open() {
      if (!control) return false;
      returnFocus = documentRef.activeElement || null;
      control.hidden = false;
      input?.focus?.();
      input?.select?.();
      apply();
      return true;
    }

    function dismiss() {
      if (!control || control.hidden) return false;
      control.hidden = true;
      clearClasses();
      matches = [];
      index = -1;
      returnFocus?.focus?.();
      returnFocus = null;
      return true;
    }

    function createControl() {
      const existing = documentRef.querySelector(`#${CONTROL_ID}`);
      if (existing) return existing;
      const wrapper = documentRef.createElement('div');
      wrapper.id = CONTROL_ID;
      wrapper.className = 'in-chat-find';
      wrapper.hidden = true;
      wrapper.setAttribute('role', 'search');
      wrapper.setAttribute('aria-label', 'Bu sohbette ara');

      const field = documentRef.createElement('input');
      field.type = 'search';
      field.maxLength = MAX_QUERY_CHARS;
      field.autocomplete = 'off';
      field.spellcheck = false;
      field.placeholder = 'Bu sohbette ara';
      field.setAttribute('aria-label', 'Mesajlarda ara');

      const state = documentRef.createElement('span');
      state.className = 'in-chat-find-status';
      state.setAttribute('role', 'status');
      state.setAttribute('aria-live', 'polite');
      state.textContent = '0/0';

      const prev = documentRef.createElement('button');
      prev.type = 'button';
      prev.textContent = '↑';
      prev.setAttribute('aria-label', 'Önceki eşleşme');
      const nxt = documentRef.createElement('button');
      nxt.type = 'button';
      nxt.textContent = '↓';
      nxt.setAttribute('aria-label', 'Sonraki eşleşme');
      const done = documentRef.createElement('button');
      done.type = 'button';
      done.textContent = '×';
      done.setAttribute('aria-label', 'Sohbet aramasını kapat');

      wrapper.append(field, state, prev, nxt, done);
      documentRef.body?.append?.(wrapper);
      return wrapper;
    }

    function onKeydown(event) {
      const key = typeof event?.key === 'string' ? event.key.toLowerCase() : '';
      const editable = event?.target?.matches?.('input,textarea,select,[contenteditable="true"]');
      if ((event?.ctrlKey || event?.metaKey) && key === 'f' && !event?.altKey) {
        event.preventDefault?.();
        open();
        return;
      }
      if (key === 'escape' && !control?.hidden) {
        event.preventDefault?.();
        dismiss();
        return;
      }
      if (key === 'enter' && event?.target === input) {
        event.preventDefault?.();
        step(event.shiftKey ? -1 : 1);
        return;
      }
      if (editable) return;
    }

    function mount() {
      messages = documentRef.querySelector('#messages');
      if (!messages || !documentRef.body) return false;
      installStyles(documentRef);
      control = createControl();
      input = control.querySelector?.('input');
      status = control.querySelector?.('.in-chat-find-status');
      const buttons = control.querySelectorAll?.('button') || [];
      [previous, next, close] = buttons;
      if (!input || !status || !previous || !next || !close) return false;
      input.addEventListener('input', apply);
      previous.addEventListener('click', () => step(-1));
      next.addEventListener('click', () => step(1));
      close.addEventListener('click', dismiss);
      documentRef.addEventListener('keydown', onKeydown, true);
      if (typeof MutationObserverImpl === 'function') {
        observer = new MutationObserverImpl(() => { if (!control.hidden) apply(); });
        observer.observe(messages, { childList: true, subtree: true, characterData: true });
      }
      return true;
    }

    function destroy() {
      observer?.disconnect?.();
      observer = null;
      documentRef.removeEventListener?.('keydown', onKeydown, true);
      clearClasses();
      control?.remove?.();
      control = null;
      matches = [];
      index = -1;
    }

    return Object.freeze({ mount, destroy, open, dismiss, apply, step });
  }

  function mount(options) {
    try {
      const controller = createController(options);
      return controller.mount() ? controller : null;
    } catch {
      return null;
    }
  }

  return Object.freeze({ MAX_QUERY_CHARS, CONTROL_ID, ACTIVE_CLASS, CURRENT_CLASS, STYLE_ID, normalizeQuery, messageText, matchingMessages, installStyles, createController, mount });
});
