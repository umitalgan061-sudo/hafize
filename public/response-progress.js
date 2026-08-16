(function exposeHafizeResponseProgress(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeResponseProgress = api;
  const install = () => api.mount({ documentRef: root.document, MutationObserverImpl: root.MutationObserver });
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeResponseProgress() {
  'use strict';

  const STATUS_ID = 'responseProgressStatus';
  const STYLE_ID = 'responseProgressStyle';
  const PREPARING_TEXT = 'Hafize yanıt hazırlıyor…';
  const STREAMING_TEXT = 'Hafize yanıt yazıyor…';
  const STYLE_TEXT = `
#${STATUS_ID}{display:flex;align-items:center;gap:7px;margin:0 4px 8px;color:var(--premium-muted);font-size:11px;line-height:1.35}
#${STATUS_ID}[hidden]{display:none}
#${STATUS_ID}::before{content:'';width:6px;height:6px;flex:0 0 auto;border-radius:50%;background:var(--premium-orange);opacity:.72}
@media(prefers-reduced-motion:no-preference){#${STATUS_ID}[data-phase="preparing"]::before,#${STATUS_ID}[data-phase="streaming"]::before{animation:hafizeResponsePulse 1.2s ease-in-out infinite}}
@keyframes hafizeResponsePulse{0%,100%{transform:scale(.8);opacity:.45}50%{transform:scale(1.15);opacity:1}}
`;

  function isStreaming(sendButton) {
    return sendButton?.classList?.contains?.('streaming') === true;
  }

  function latestAssistantText(messages) {
    const nodes = messages?.querySelectorAll?.('.message.assistant .content') || [];
    if (!nodes.length) return '';
    const value = nodes[nodes.length - 1]?.textContent;
    return typeof value === 'string' ? value : '';
  }

  function derivePhase(sendButton, messages) {
    if (!isStreaming(sendButton)) return 'idle';
    return latestAssistantText(messages).trim() ? 'streaming' : 'preparing';
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
    if (!documentRef || typeof documentRef.querySelector !== 'function') {
      throw new Error('INVALID_RESPONSE_PROGRESS_DOCUMENT');
    }

    let messages = null;
    let composer = null;
    let sendButton = null;
    let status = null;
    let observer = null;
    let mounted = false;
    let generatedStatus = false;
    let originalBusy = null;
    let lastPhase = '';

    function ensureStatus() {
      const existing = documentRef.querySelector(`#${STATUS_ID}`);
      if (existing) return existing;
      const node = documentRef.createElement('small');
      node.id = STATUS_ID;
      node.hidden = true;
      node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'polite');
      node.setAttribute('aria-atomic', 'true');
      node.title = 'Yanıt sürerken kare gönder düğmesiyle durdurabilirsin.';
      composer.prepend?.(node);
      generatedStatus = Boolean(node.parentNode);
      return node;
    }

    function paint(phase) {
      if (!status || !messages) return false;
      const next = phase === 'preparing' || phase === 'streaming' ? phase : 'idle';
      messages.setAttribute?.('aria-busy', String(next !== 'idle'));
      if (next === lastPhase) return false;
      lastPhase = next;
      status.dataset.phase = next;
      if (next === 'idle') {
        status.hidden = true;
        status.textContent = '';
        return true;
      }
      status.hidden = false;
      status.textContent = next === 'preparing' ? PREPARING_TEXT : STREAMING_TEXT;
      return true;
    }

    function refresh() {
      if (!mounted) return 'idle';
      const phase = derivePhase(sendButton, messages);
      paint(phase);
      return phase;
    }

    function mount() {
      if (mounted) return false;
      messages = documentRef.querySelector('#messages');
      composer = documentRef.querySelector('#composer');
      sendButton = documentRef.querySelector('#sendBtn');
      if (!messages || !composer || !sendButton) return false;
      originalBusy = messages.getAttribute?.('aria-busy');
      installStyles(documentRef);
      status = ensureStatus();
      mounted = true;
      refresh();
      if (typeof MutationObserverImpl === 'function') {
        observer = new MutationObserverImpl(refresh);
        observer.observe(sendButton, { attributes: true, attributeFilter: ['class'] });
        observer.observe(messages, { childList: true, subtree: true, characterData: true });
      }
      return true;
    }

    function destroy() {
      if (!mounted) return false;
      observer?.disconnect?.();
      observer = null;
      if (originalBusy === null || originalBusy === undefined) messages?.removeAttribute?.('aria-busy');
      else messages?.setAttribute?.('aria-busy', originalBusy);
      if (generatedStatus) status?.remove?.();
      status = null;
      messages = null;
      composer = null;
      sendButton = null;
      originalBusy = null;
      lastPhase = '';
      mounted = false;
      return true;
    }

    return Object.freeze({ mount, destroy, refresh, paint, snapshot: () => Object.freeze({ mounted, phase: lastPhase }) });
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
    STATUS_ID,
    STYLE_ID,
    PREPARING_TEXT,
    STREAMING_TEXT,
    isStreaming,
    latestAssistantText,
    derivePhase,
    installStyles,
    createController,
    mount
  });
});
