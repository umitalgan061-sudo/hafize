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

  function snapshotButton(node) {
    return Object.freeze({
      hidden: Boolean(node.hidden),
      disabled: Boolean(node.disabled),
      textContent: node.textContent,
      hadState: Object.prototype.hasOwnProperty.call(node.dataset || {}, 'state'),
      state: node.dataset?.state
    });
  }

  function restoreButton(node, snapshot) {
    if (!node || !snapshot) return;
    node.hidden = snapshot.hidden;
    node.disabled = snapshot.disabled;
    node.textContent = snapshot.textContent;
    if (snapshot.hadState) node.dataset.state = snapshot.state;
    else delete node.dataset.state;
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
    let mounted = false;
    let generation = 0;
    let ownsButton = false;
    let buttonSnapshot = null;
    let clickHandler = null;

    function clearResetTimer() {
      if (resetTimer !== null) clearTimeoutImpl(resetTimer);
      resetTimer = null;
    }

    function isCurrent(expectedGeneration = generation) {
      return mounted && expectedGeneration === generation;
    }

    function setIdle(expectedGeneration = generation) {
      if (!isCurrent(expectedGeneration)) return;
      clearResetTimer();
      if (!button) return;
      button.textContent = 'Sohbeti kopyala';
      button.dataset.state = 'idle';
      syncAvailability();
    }

    function showState(state, label, expectedGeneration = generation) {
      if (!isCurrent(expectedGeneration) || !button) return;
      clearResetTimer();
      button.dataset.state = state;
      button.textContent = label;
      button.disabled = state === 'copying';
      resetTimer = setTimeoutImpl(() => setIdle(expectedGeneration), RESET_DELAY_MS);
    }

    function getTranscript() {
      if (!mounted) return null;
      return transcriptFromMessages(messages?.querySelectorAll?.('.message') || []);
    }

    function syncAvailability() {
      if (!mounted || !button) return false;
      button.hidden = !getTranscript();
      button.disabled = button.dataset.state === 'copying';
      return !button.hidden;
    }

    async function copyConversation() {
      if (!mounted) return false;
      const expectedGeneration = generation;
      const transcript = getTranscript();
      if (!transcript) {
        showState('error', 'Kopyalanamadı', expectedGeneration);
        return false;
      }
      if (!secureContext || typeof clipboard?.writeText !== 'function') {
        showState('error', 'Clipboard kapalı', expectedGeneration);
        return false;
      }
      showState('copying', 'Kopyalanıyor…', expectedGeneration);
      try {
        await clipboard.writeText(transcript);
        if (isCurrent(expectedGeneration)) showState('success', 'Sohbet kopyalandı', expectedGeneration);
        return true;
      } catch {
        if (isCurrent(expectedGeneration)) showState('error', 'Kopyalanamadı', expectedGeneration);
        return false;
      }
    }

    function createOwnedButton(host) {
      const control = documentRef.createElement('button');
      control.id = CONTROL_ID;
      control.type = 'button';
      control.className = 'mini-btn conversation-copy-button';
      control.dataset.state = 'idle';
      control.textContent = 'Sohbeti kopyala';
      control.setAttribute('aria-label', 'Mevcut sohbetin görünür mesajlarını kopyala');
      host.append(control);
      return control;
    }

    function rollbackMount() {
      observer?.disconnect?.();
      observer = null;
      clearResetTimer();
      if (button && clickHandler) button.removeEventListener?.('click', clickHandler);
      if (button) {
        if (ownsButton) button.remove?.();
        else restoreButton(button, buttonSnapshot);
      }
      button = null;
      messages = null;
      clickHandler = null;
      buttonSnapshot = null;
      ownsButton = false;
      mounted = false;
      generation += 1;
    }

    function mount() {
      if (mounted) return true;
      const nextMessages = documentRef.querySelector('#messages');
      const historyHead = documentRef.querySelector('.history-head');
      if (!nextMessages || !historyHead) return false;

      const existing = documentRef.querySelector(`#${CONTROL_ID}`);
      if (existing && (typeof existing.addEventListener !== 'function' || typeof existing.removeEventListener !== 'function')) return false;

      messages = nextMessages;
      button = existing || createOwnedButton(historyHead);
      ownsButton = !existing;
      buttonSnapshot = existing ? snapshotButton(existing) : null;
      mounted = true;
      generation += 1;
      const mountGeneration = generation;
      clickHandler = () => {
        if (isCurrent(mountGeneration)) void copyConversation();
      };
      button.addEventListener('click', clickHandler);

      try {
        syncAvailability();
        if (typeof MutationObserverImpl === 'function') {
          observer = new MutationObserverImpl(() => {
            if (isCurrent(mountGeneration)) syncAvailability();
          });
          observer.observe(messages, { childList: true, subtree: true, characterData: true });
        }
        return true;
      } catch {
        rollbackMount();
        return false;
      }
    }

    function destroy() {
      if (!mounted) return;
      mounted = false;
      generation += 1;
      observer?.disconnect?.();
      observer = null;
      clearResetTimer();
      if (button && clickHandler) button.removeEventListener?.('click', clickHandler);
      if (button) {
        if (ownsButton) button.remove?.();
        else restoreButton(button, buttonSnapshot);
      }
      button = null;
      messages = null;
      clickHandler = null;
      buttonSnapshot = null;
      ownsButton = false;
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