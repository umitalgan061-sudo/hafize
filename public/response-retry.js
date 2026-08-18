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

    let observer = null;
    let mounted = false;
    let status = null;
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
      if (existing) return existing;
      const node = documentRef.createElement('p');
      node.id = STATUS_ID;
      node.className = 'agent-hint response-retry-status';
      node.hidden = true;
      node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'polite');
      composer.append(node);
      return node;
    }

    function showStatus(text) {
      if (!status) return;
      status.textContent = text;
      status.hidden = !text;
    }

    function clearActions(messages) {
      messages?.querySelectorAll?.(`.${ACTION_CLASS}`)?.forEach?.((node) => node.remove());
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
      if (pair.assistant.querySelector?.(`.${ACTION_CLASS}`)) return false;
      const wrap = documentRef.createElement('div');
      wrap.className = ACTION_CLASS;
      const button = documentRef.createElement('button');
      button.type = 'button';
      button.className = 'mini-btn response-retry-button';
      button.textContent = '↻ Tekrar dene';
      button.setAttribute('aria-label', 'Bu kullanıcı isteğini yeni bir sohbet dalında yeniden hazırla');
      button.title = 'Kaynak sohbeti değiştirmeden bu turdan yeni bir dal hazırlar';
      button.addEventListener('click', () => prepareRetryBranch(pair));
      wrap.append(button);
      pair.assistant.append(wrap);
      return true;
    }

    function render() {
      const { messages, composer, send } = nodes();
      if (!messages || !composer || !send) return false;
      if (isStreaming(send)) {
        clearActions(messages);
        return false;
      }
      const pairs = getRenderedPairs(messages);
      if (!pairs.length) {
        clearActions(messages);
        return false;
      }
      for (const pair of pairs) decoratePair(pair);
      return true;
    }

    function mount() {
      if (mounted) return false;
      const { messages, composer, input, send } = nodes();
      if (!messages || !composer || !input || !send) return false;
      status = ensureStatus(composer);
      inputListener = () => { if (!hasDraft(input.value)) showStatus(''); };
      input.addEventListener?.('input', inputListener);
      observer = typeof MutationObserverImpl === 'function'
        ? new MutationObserverImpl(() => render())
        : null;
      observer?.observe?.(messages, { childList: true, subtree: true, characterData: true });
      observer?.observe?.(send, { attributes: true, attributeFilter: ['class'] });
      mounted = true;
      render();
      return true;
    }

    function destroy() {
      if (!mounted) return false;
      const { messages, input } = nodes();
      observer?.disconnect?.();
      observer = null;
      if (inputListener) input?.removeEventListener?.('input', inputListener);
      inputListener = null;
      clearActions(messages);
      status?.remove?.();
      status = null;
      mounted = false;
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
