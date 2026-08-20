(function exposeHafizeResponseRetry(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeResponseRetry = api;
  api.mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeResponseRetry() {
  'use strict';

  const ACTION_CLASS = 'response-retry-action';
  const STATUS_ID = 'responseRetryStatus';
  const MAX_PROMPT_CHARS = 12_000;
  const DRAFT_BLOCKED = 'Gönderilmemiş taslağın var. Tekrar denemeden önce taslağı gönder veya temizle.';
  const PROMPT_UNAVAILABLE = 'Tekrar denenecek kullanıcı isteği bulunamadı.';
  const EDIT_UNAVAILABLE = 'Güvenli düzenleme dalı hazır değil.';
  const INSTALL_MARKER = Symbol.for('hafize.response.retry.controller.v1');

  function normalizePrompt(value) {
    if (typeof value !== 'string') return '';
    const text = value.normalize('NFC').replace(/\u0000/g, '').trim();
    if (!text || text.length > MAX_PROMPT_CHARS) return '';
    return text;
  }

  function hasDraft(value) {
    return Boolean(normalizePrompt(value));
  }

  function isStreaming(sendButton) {
    return Boolean(sendButton?.classList?.contains?.('streaming'));
  }

  function lastRetryPair(messages) {
    if (!Array.isArray(messages) || messages.length < 2) return null;
    for (let index = messages.length - 1; index > 0; index -= 1) {
      const assistant = messages[index];
      const user = messages[index - 1];
      if (assistant?.role !== 'assistant' || user?.role !== 'user') continue;
      const prompt = normalizePrompt(user.content);
      if (!prompt) return null;
      return Object.freeze({ assistantId: assistant.id || '', userId: user.id || '', prompt });
    }
    return null;
  }

  function createController({
    documentRef = globalThis.document,
    MutationObserverImpl = globalThis.MutationObserver
  } = {}) {
    if (!documentRef || typeof documentRef.querySelector !== 'function') {
      throw new Error('INVALID_RESPONSE_RETRY_DOCUMENT');
    }

    const ownerToken = Object.freeze({});
    const ownedActions = new Set();
    const actionListeners = new Map();
    let observer = null;
    let mounted = false;
    let messagesOwner = null;
    let status = null;
    let statusOwned = false;
    let statusSnapshot = null;
    let inputOwner = null;
    let inputListener = null;

    function nodes() {
      return Object.freeze({
        messages: documentRef.querySelector('#messages'),
        composer: documentRef.querySelector('#composer'),
        input: documentRef.querySelector('#messageInput'),
        send: documentRef.querySelector('#sendBtn')
      });
    }

    function ensureStatus(composer) {
      const existing = documentRef.querySelector(`#${STATUS_ID}`);
      if (existing) {
        statusOwned = false;
        statusSnapshot = Object.freeze({
          textContent: existing.textContent,
          hidden: Boolean(existing.hidden)
        });
        return existing;
      }
      const node = documentRef.createElement('p');
      node.id = STATUS_ID;
      node.className = 'agent-hint response-retry-status';
      node.hidden = true;
      node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'polite');
      composer.append(node);
      statusOwned = true;
      statusSnapshot = null;
      return node;
    }

    function restoreStatus() {
      if (!status) return;
      if (statusOwned) {
        status.remove?.();
      } else if (statusSnapshot) {
        status.textContent = statusSnapshot.textContent;
        status.hidden = statusSnapshot.hidden;
      }
      status = null;
      statusOwned = false;
      statusSnapshot = null;
    }

    function showStatus(text) {
      if (!status || !mounted) return;
      status.textContent = text;
      status.hidden = !text;
    }

    function removeOwnedAction(node) {
      const record = actionListeners.get(node);
      if (record) record.button?.removeEventListener?.('click', record.handler);
      actionListeners.delete(node);
      ownedActions.delete(node);
      node?.remove?.();
    }

    function clearActions() {
      for (const node of [...ownedActions]) removeOwnedAction(node);
    }

    function pairForArticles(user, assistant) {
      if (!assistant?.classList?.contains?.('assistant') || !user?.classList?.contains?.('user')) return null;
      const prompt = normalizePrompt(user.querySelector?.('.content')?.textContent || '');
      const userMessageId = typeof user.dataset?.messageId === 'string' ? user.dataset.messageId.trim() : '';
      return prompt && userMessageId ? { assistant, user, prompt, userMessageId } : null;
    }

    function getRenderedPairs(messages) {
      const articles = Array.from(messages?.querySelectorAll?.('.message') || []);
      const pairs = [];
      for (let index = 1; index < articles.length; index += 1) {
        const pair = pairForArticles(articles[index - 1], articles[index]);
        if (pair) pairs.push(pair);
      }
      return pairs;
    }

    function getRenderedPair(messages) {
      return getRenderedPairs(messages).at(-1) || null;
    }

    function prepareRetryBranch(pair) {
      if (!mounted) return false;
      const { input, send } = nodes();
      if (!input || !send || isStreaming(send)) return false;
      if (hasDraft(input.value)) {
        showStatus(DRAFT_BLOCKED);
        input.focus?.();
        return false;
      }
      const clean = normalizePrompt(pair?.prompt);
      if (!clean || !pair?.userMessageId) {
        showStatus(PROMPT_UNAVAILABLE);
        return false;
      }
      const editButton = pair.user?.querySelector?.('.message-edit-btn');
      if (!editButton || typeof editButton.click !== 'function' || editButton.disabled) {
        showStatus(EDIT_UNAVAILABLE);
        return false;
      }
      showStatus('Yeni tekrar dalı hazırlanıyor…');
      editButton.click();
      return true;
    }

    function decoratePair(pair) {
      if (!mounted || pair.assistant.querySelector?.(`.${ACTION_CLASS}`)) return false;
      const wrap = documentRef.createElement('div');
      wrap.className = ACTION_CLASS;
      const button = documentRef.createElement('button');
      button.type = 'button';
      button.className = 'mini-btn response-retry-button';
      button.textContent = '↻ Tekrar dene';
      button.setAttribute('aria-label', 'Bu kullanıcı isteğini yeni bir sohbet dalında yeniden hazırla');
      button.title = 'Kaynak sohbeti değiştirmeden bu turdan yeni bir dal hazırlar';
      const handler = () => {
        if (mounted && messagesOwner?.[INSTALL_MARKER] === ownerToken) prepareRetryBranch(pair);
      };
      button.addEventListener('click', handler);
      wrap.append(button);
      pair.assistant.append(wrap);
      ownedActions.add(wrap);
      actionListeners.set(wrap, { button, handler });
      return true;
    }

    function render() {
      if (!mounted || messagesOwner?.[INSTALL_MARKER] !== ownerToken) return false;
      const { messages, composer, send } = nodes();
      if (messages !== messagesOwner || !messages || !composer || !send) return false;
      if (isStreaming(send)) {
        clearActions();
        return false;
      }
      const pairs = getRenderedPairs(messages);
      if (!pairs.length) {
        clearActions();
        return false;
      }
      for (const pair of pairs) decoratePair(pair);
      return true;
    }

    function releaseOwnership() {
      if (messagesOwner?.[INSTALL_MARKER] === ownerToken) {
        try { delete messagesOwner[INSTALL_MARKER]; } catch { messagesOwner[INSTALL_MARKER] = undefined; }
      }
      messagesOwner = null;
    }

    function rollbackMount() {
      observer?.disconnect?.();
      observer = null;
      if (inputListener && inputOwner) inputOwner.removeEventListener?.('input', inputListener);
      inputListener = null;
      inputOwner = null;
      clearActions();
      restoreStatus();
      releaseOwnership();
      mounted = false;
    }

    function mount() {
      if (mounted) return false;
      const { messages, composer, input, send } = nodes();
      if (!messages || !composer || !input || !send) return false;
      if (messages[INSTALL_MARKER]) return false;

      messages[INSTALL_MARKER] = ownerToken;
      messagesOwner = messages;
      mounted = true;
      try {
        status = ensureStatus(composer);
        inputOwner = input;
        inputListener = () => { if (!hasDraft(input.value)) showStatus(''); };
        input.addEventListener?.('input', inputListener);
        observer = typeof MutationObserverImpl === 'function'
          ? new MutationObserverImpl(() => render())
          : null;
        observer?.observe?.(messages, { childList: true, subtree: true, characterData: true });
        observer?.observe?.(send, { attributes: true, attributeFilter: ['class'] });
        render();
        return true;
      } catch {
        rollbackMount();
        return false;
      }
    }

    function destroy() {
      if (!mounted) return false;
      rollbackMount();
      return true;
    }

    return Object.freeze({ mount, destroy, render, prepareRetryBranch, getRenderedPair, getRenderedPairs, decoratePair });
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
    ACTION_CLASS,
    STATUS_ID,
    MAX_PROMPT_CHARS,
    DRAFT_BLOCKED,
    PROMPT_UNAVAILABLE,
    EDIT_UNAVAILABLE,
    normalizePrompt,
    hasDraft,
    isStreaming,
    lastRetryPair,
    createController,
    mount
  });
});
