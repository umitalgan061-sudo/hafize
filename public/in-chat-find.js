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
  const TRIGGER_ID = 'inChatFindTrigger';
  const ACTIVE_CLASS = 'in-chat-find-match';
  const CURRENT_CLASS = 'in-chat-find-current';
  const STYLE_ID = 'hafize-in-chat-find-style';
  const STYLE_TEXT = `
+.in-chat-find{position:fixed;top:74px;right:18px;z-index:35;display:flex;align-items:center;gap:6px;padding:8px;border:1px solid var(--line,#ddd);border-radius:12px;background:var(--surface,#fff);box-shadow:0 10px 30px rgba(0,0,0,.12)}
+.in-chat-find[hidden]{display:none}
+.in-chat-find input{width:min(220px,48vw);border:1px solid var(--line,#ddd);border-radius:8px;background:transparent;color:inherit;padding:7px 8px;font:inherit;font-size:12px}
+.in-chat-find button{border:1px solid var(--line,#ddd);border-radius:8px;background:transparent;color:inherit;padding:6px 8px;font:inherit;font-size:11px;cursor:pointer}
+.in-chat-find-status{min-width:48px;color:var(--muted,#777);font-size:11px;text-align:center}
+.in-chat-find-trigger{white-space:nowrap}
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

  function snapshotAttribute(node, name) {
    if (!node?.getAttribute || !node?.hasAttribute) return null;
    return Object.freeze({ present: node.hasAttribute(name), value: node.getAttribute(name) });
  }

  function restoreAttribute(node, name, snapshot) {
    if (!node || !snapshot) return;
    if (snapshot.present) node.setAttribute?.(name, snapshot.value ?? '');
    else node.removeAttribute?.(name);
  }

  function createController({
    documentRef = globalThis.document,
    MutationObserverImpl = globalThis.MutationObserver
  } = {}) {
    if (!documentRef || typeof documentRef.querySelector !== 'function') throw new Error('INVALID_IN_CHAT_FIND_DOCUMENT');

    let control = null;
    let trigger = null;
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
    let mounted = false;
    let ownsControl = false;
    let ownsTrigger = false;
    let hostSnapshot = null;

    function allMessages() {
      return mounted ? messages?.querySelectorAll?.('.message') || [] : [];
    }

    function clearClasses() {
      for (const article of Array.from(messages?.querySelectorAll?.('.message') || [])) {
        article.classList?.remove?.(ACTIVE_CLASS);
        article.classList?.remove?.(CURRENT_CLASS);
      }
    }

    function updateStatus() {
      if (!mounted || !status) return;
      status.textContent = matches.length && index >= 0 ? `${index + 1}/${matches.length}` : '0/0';
      if (previous) previous.disabled = matches.length === 0;
      if (next) next.disabled = matches.length === 0;
    }

    function focusCurrent({ smooth = false } = {}) {
      if (!mounted) return null;
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
      if (!mounted) return false;
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
      if (!mounted || !matches.length) return false;
      index = (index + delta + matches.length) % matches.length;
      focusCurrent({ smooth: true });
      return true;
    }

    function open(source = documentRef.activeElement) {
      if (!mounted || !control) return false;
      returnFocus = source && typeof source.focus === 'function' ? source : trigger;
      control.hidden = false;
      trigger?.setAttribute?.('aria-expanded', 'true');
      input?.focus?.();
      input?.select?.();
      apply();
      return true;
    }

    function dismiss() {
      if (!mounted || !control || control.hidden) return false;
      control.hidden = true;
      trigger?.setAttribute?.('aria-expanded', 'false');
      clearClasses();
      matches = [];
      index = -1;
      returnFocus?.focus?.();
      returnFocus = null;
      return true;
    }

    function createTrigger(host) {
      const existing = documentRef.querySelector(`#${TRIGGER_ID}`);
      if (existing) return existing;
      const button = documentRef.createElement('button');
      button.id = TRIGGER_ID;
      button.type = 'button';
      button.className = 'mini-btn in-chat-find-trigger';
      button.textContent = 'Sohbette ara';
      button.setAttribute('aria-controls', CONTROL_ID);
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-label', 'Aktif sohbet mesajlarında ara');
      host.append?.(button);
      return button;
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

    function onTriggerClick() { open(trigger); }
    function onPreviousClick() { step(-1); }
    function onNextClick() { step(1); }
    function onMutation() { if (mounted && control && !control.hidden) apply(); }

    function onKeydown(event) {
      if (!mounted) return;
      const key = typeof event?.key === 'string' ? event.key.toLowerCase() : '';
      if ((event?.ctrlKey || event?.metaKey) && key === 'f' && !event?.altKey) {
        event.preventDefault?.();
        open(event.target);
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
      }
    }

    function restoreHostState() {
      if (!hostSnapshot) return;
      if (!ownsControl && control) {
        control.hidden = hostSnapshot.controlHidden;
        if (status) status.textContent = hostSnapshot.statusText;
        if (previous) previous.disabled = hostSnapshot.previousDisabled;
        if (next) next.disabled = hostSnapshot.nextDisabled;
      }
      if (!ownsTrigger && trigger) restoreAttribute(trigger, 'aria-expanded', hostSnapshot.triggerExpanded);
    }

    function detach() {
      observer?.disconnect?.();
      documentRef.removeEventListener?.('keydown', onKeydown, true);
      trigger?.removeEventListener?.('click', onTriggerClick);
      input?.removeEventListener?.('input', apply);
      previous?.removeEventListener?.('click', onPreviousClick);
      next?.removeEventListener?.('click', onNextClick);
      close?.removeEventListener?.('click', dismiss);
      clearClasses();
      restoreHostState();
      if (ownsControl) control?.remove?.();
      if (ownsTrigger) trigger?.remove?.();
    }

    function clearReferences() {
      control = null;
      trigger = null;
      input = null;
      status = null;
      previous = null;
      next = null;
      close = null;
      messages = null;
      observer = null;
      matches = [];
      index = -1;
      returnFocus = null;
      ownsControl = false;
      ownsTrigger = false;
      hostSnapshot = null;
      mounted = false;
    }

    function mount() {
      if (mounted) return true;

      const candidateMessages = documentRef.querySelector('#messages');
      const historyHead = documentRef.querySelector('.history-head');
      if (!candidateMessages || !historyHead || !documentRef.body) return false;

      installStyles(documentRef);
      const existingTrigger = documentRef.querySelector(`#${TRIGGER_ID}`);
      const existingControl = documentRef.querySelector(`#${CONTROL_ID}`);
      const candidateTrigger = createTrigger(historyHead);
      const candidateControl = createControl();
      const candidateInput = candidateControl?.querySelector?.('input') || null;
      const candidateStatus = candidateControl?.querySelector?.('.in-chat-find-status') || null;
      const buttons = Array.from(candidateControl?.querySelectorAll?.('button') || []);
      const [candidatePrevious, candidateNext, candidateClose] = buttons;
      const createdTrigger = !existingTrigger && Boolean(candidateTrigger);
      const createdControl = !existingControl && Boolean(candidateControl);

      if (!candidateTrigger || !candidateControl || !candidateInput || !candidateStatus || !candidatePrevious || !candidateNext || !candidateClose) {
        if (createdControl) candidateControl?.remove?.();
        if (createdTrigger) candidateTrigger?.remove?.();
        return false;
      }

      messages = candidateMessages;
      trigger = candidateTrigger;
      control = candidateControl;
      input = candidateInput;
      status = candidateStatus;
      previous = candidatePrevious;
      next = candidateNext;
      close = candidateClose;
      ownsTrigger = createdTrigger;
      ownsControl = createdControl;
      hostSnapshot = Object.freeze({
        controlHidden: Boolean(control.hidden),
        statusText: status.textContent,
        previousDisabled: Boolean(previous.disabled),
        nextDisabled: Boolean(next.disabled),
        triggerExpanded: snapshotAttribute(trigger, 'aria-expanded')
      });
      mounted = true;

      try {
        trigger.addEventListener('click', onTriggerClick);
        input.addEventListener('input', apply);
        previous.addEventListener('click', onPreviousClick);
        next.addEventListener('click', onNextClick);
        close.addEventListener('click', dismiss);
        documentRef.addEventListener('keydown', onKeydown, true);
        if (typeof MutationObserverImpl === 'function') {
          observer = new MutationObserverImpl(onMutation);
          observer.observe(messages, { childList: true, subtree: true, characterData: true });
        }
        return true;
      } catch {
        detach();
        clearReferences();
        return false;
      }
    }

    function destroy() {
      if (!mounted) return false;
      mounted = false;
      detach();
      clearReferences();
      return true;
    }

    return Object.freeze({ mount, destroy, open, dismiss, apply, step, isMounted: () => mounted });
  }

  function mount(options) {
    try {
      const controller = createController(options);
      return controller.mount() ? controller : null;
    } catch {
      return null;
    }
  }

  return Object.freeze({ MAX_QUERY_CHARS, CONTROL_ID, TRIGGER_ID, ACTIVE_CLASS, CURRENT_CLASS, STYLE_ID, normalizeQuery, messageText, matchingMessages, installStyles, createController, mount });
});