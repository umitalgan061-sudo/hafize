(function exposeHafizeConversationCopy(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeConversationCopy = api;
  api.mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeConversationCopy() {
  'use strict';

  const MAX_COPY_CHARS = 512 * 1024;
  const CONTROL_ID = 'conversationCopyButton';
  const RESET_DELAY_MS = 1800;

  function normalizeMessageText(value) {
    if (typeof value !== 'string') return null;
    const text = value.replace(/\r\n/g, '\n');
    if (!text.trim()) return null;
    return text;
  }

  function transcriptFromMessages(messages) {
    const parts = [];
    let size = 0;
    for (const article of Array.from(messages || [])) {
      if (!article?.classList?.contains('message')) continue;
      const content = article.querySelector?.('.content');
      const text = normalizeMessageText(content?.textContent);
      if (!text) continue;
      const role = article.classList.contains('user') ? 'Sen' : 'Hafize';
      const block = `${role}:\n${text}`;
      const separator = parts.length ? '\n\n' : '';
      if (size + separator.length + block.length > MAX_COPY_CHARS) return null;
      parts.push(block);
      size += separator.length + block.length;
    }
    return parts.length ? parts.join('\n\n') : null;
  }

  function createController({
    documentRef = globalThis.document,
    clipboard = globalThis.navigator?.clipboard,
    secureContext = globalThis.isSecureContext === true,
    MutationObserverImpl = globalThis.MutationObserver,
    setTimeoutImpl = globalThis.setTimeout,
    clearTimeoutImpl = globalThis.clearTimeout
  } = {}) {
    if (!documentRef || typeof documentRef.querySelector !== 'function') throw new Error('INVALID_CONVERSATION_COPY_DOCUMENT');
    if (typeof setTimeoutImpl !== 'function' || typeof clearTimeoutImpl !== 'function') throw new Error('INVALID_CONVERSATION_COPY_TIMER');

    let observer = null;
    let button = null;
    let resetTimer = null;
    let messages = null;

    function clearResetTimer() {
      if (resetTimer !== null) clearTimeoutImpl(resetTimer);
      resetTimer = null;
    }

    function setIdle() {
      clearResetTimer();
      if (!button) return;
      button.textContent = 'Sohbeti kopyala';
      button.dataset.state = 'idle';
      syncAvailability();
    }

    function showState(state, label) {
      if (!button) return;
      clearResetTimer();
      button.dataset.state = state;
      button.textContent = label;
      button.disabled = state === 'copying';
      resetTimer = setTimeoutImpl(setIdle, RESET_DELAY_MS);
    }

    function getTranscript() {
      return transcriptFromMessages(messages?.querySelectorAll?.('.message') || []);
    }

    function syncAvailability() {
      if (!button) return false;
      button.hidden = !getTranscript();
      button.disabled = button.dataset.state === 'copying';
      return !button.hidden;
    }

    async function copyConversation() {
      const transcript = getTranscript();
      if (!transcript) {
        showState('error', 'Kopyalanamadı');
        return false;
      }
      if (!secureContext || typeof clipboard?.writeText !== 'function') {
        showState('error', 'Clipboard kapalı');
        return false;
      }
      showState('copying', 'Kopyalanıyor…');
      try {
        await clipboard.writeText(transcript);
        showState('success', 'Sohbet kopyalandı');
        return true;
      } catch {
        showState('error', 'Kopyalanamadı');
        return false;
      }
    }

    function createButton(host) {
      const existing = documentRef.querySelector(`#${CONTROL_ID}`);
      if (existing) return existing;
      const control = documentRef.createElement('button');
      control.id = CONTROL_ID;
      control.type = 'button';
      control.className = 'mini-btn conversation-copy-button';
      control.dataset.state = 'idle';
      control.textContent = 'Sohbeti kopyala';
      control.setAttribute('aria-label', 'Mevcut sohbetin görünür mesajlarını kopyala');
      control.addEventListener('click', () => { void copyConversation(); });
      host.append(control);
      return control;
    }

    function mount() {
      messages = documentRef.querySelector('#messages');
      const historyHead = documentRef.querySelector('.history-head');
      if (!messages || !historyHead) return false;
      button = createButton(historyHead);
      syncAvailability();
      if (typeof MutationObserverImpl === 'function') {
        observer = new MutationObserverImpl(syncAvailability);
        observer.observe(messages, { childList: true, subtree: true, characterData: true });
      }
      return true;
    }

    function destroy() {
      observer?.disconnect?.();
      observer = null;
      clearResetTimer();
      button?.remove?.();
      button = null;
      messages = null;
    }

    return Object.freeze({ mount, destroy, copyConversation, getTranscript, syncAvailability });
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
    MAX_COPY_CHARS,
    CONTROL_ID,
    RESET_DELAY_MS,
    normalizeMessageText,
    transcriptFromMessages,
    createController,
    mount
  });
});
