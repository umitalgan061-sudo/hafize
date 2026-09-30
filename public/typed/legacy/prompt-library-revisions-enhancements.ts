(function installPromptRevisionEnhancements(root) {
  'use strict';
  const PANEL = '#promptLibraryRevisions';
  const CARD = '#promptLibraryCard';
  let booted = false;
  let observer = null;
  const listeners = [];
  const doc = () => root.document;
  const api = () => root.HafizePromptLibraryRevisions;
  const storage = () => root.localStorage;
  const promptIds = () => [...doc()?.querySelectorAll?.('#promptLibraryList .prompt-item[data-prompt-id]') || []]
    .map((row) => row.dataset.promptId).filter(Boolean);

  function status(message) {
    const node = doc()?.querySelector?.(`${PANEL} .prompt-library-revisions-status`);
    if (!node) return;
    node.textContent = String(message ?? '').slice(0, 160);
  }

  function button(label, action) {
    const node = doc().createElement('button');
    node.type = 'button';
    node.className = 'mini-btn prompt-library-revision-enhancement';
    node.textContent = label;
    node.dataset.promptRevisionAction = action;
    node.setAttribute('aria-label', label);
    return node;
  }

  function jumpToPrompt(id) {
    const row = doc()?.querySelector?.(`#promptLibraryList .prompt-item[data-prompt-id="${CSS.escape(id)}"]`);
    row?.scrollIntoView?.({ block: 'nearest' });
    row?.querySelector?.('button')?.focus?.();
  }

  function onClick(event) {
    const target = event.target?.closest?.('[data-prompt-revision-action]');
    if (!target) return;
    if (target.dataset.promptRevisionAction === 'open-current') {
      const selected = doc().querySelector(`${PANEL} select`);
      if (selected?.value) jumpToPrompt(selected.value);
      return;
    }
    if (target.dataset.promptRevisionAction === 'clear-history') {
      const selected = doc().querySelector(`${PANEL} select`);
      if (!selected?.value) return status('Önce bir istem seç.');
      if (!root.confirm?.('Bu istemin sürüm geçmişi temizlensin mi?')) return;
      if (!api()?.removePromptRevisions?.(selected.value, storage())) return status('Sürüm geçmişi temizlenemedi.');
      api()?.mount;
      root.dispatchEvent?.(new root.Event('storage'));
      status('Sürüm geçmişi temizlendi.');
    }
  }

  function enhance() {
    const panel = doc()?.querySelector?.(PANEL);
    if (!panel) return;
    let toolbar = panel.querySelector('.prompt-library-revisions-enhancement-toolbar');
    if (!toolbar) {
      toolbar = doc().createElement('div');
      toolbar.className = 'prompt-library-revisions-enhancement-toolbar';
      panel.querySelector('.prompt-library-revisions-body')?.prepend(toolbar);
      toolbar.addEventListener('click', onClick);
      listeners.push(() => toolbar.removeEventListener('click', onClick));
    }
    toolbar.replaceChildren(button('Mevcut isteme git', 'open-current'), button('Geçmişi temizle', 'clear-history'));
  }

  function boot() {
    if (booted || !api() || !doc()) return;
    const panel = doc().querySelector(PANEL);
    if (!panel) return;
    booted = true;
    observer = typeof MutationObserver === 'function' ? new MutationObserver(enhance) : null;
    observer?.observe(panel, { childList: true, subtree: true });
    enhance();
    root.addEventListener?.('hafize:prompt-library-changed', enhance);
    listeners.push(() => root.removeEventListener?.('hafize:prompt-library-changed', enhance));
  }

  const start = () => boot();
  if (doc()?.readyState === 'loading') doc().addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  root.addEventListener?.('beforeunload', () => { observer?.disconnect?.(); for (const off of listeners.splice(0)) off(); });
})(typeof globalThis !== 'undefined' ? globalThis : self);

(function bootstrapChatMarkdown(root) {
  'use strict';
  const DOC_KEY = 'hafize.chat-markdown.bootstrap.v1';
  const STYLE = '/chat-markdown.css';
  const RENDERER = '/markdown-renderer.js';
  const CHAT = '/chat-markdown.js';
  const loaded = new Set();
  function markOnce(key) {
    try {
      if (root.sessionStorage?.getItem?.(DOC_KEY + key) === '1') return false;
      root.sessionStorage?.setItem?.(DOC_KEY + key, '1');
    } catch {}
    return true;
  }
  function loadLink() {
    if (!root.document || !markOnce('style') || loaded.has(STYLE)) return;
    const link = root.document.createElement('link');
    link.rel = 'stylesheet';
    link.href = STYLE;
    link.setAttribute('data-hafize-chat-markdown', 'style');
    root.document.head?.append(link);
    loaded.add(STYLE);
  }
  function loadScript(src, onload) {
    if (!root.document || loaded.has(src)) return;
    const script = root.document.createElement('script');
    script.src = src;
    script.defer = true;
    script.dataset.hafizeChatMarkdown = 'true';
    if (onload) script.addEventListener('load', onload, { once: true });
    root.document.head?.append(script);
    loaded.add(src);
  }
  function boot() {
    loadLink();
    loadScript(RENDERER, () => loadScript(CHAT));
  }
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);