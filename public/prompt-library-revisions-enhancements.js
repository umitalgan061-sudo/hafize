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
    .map((row) => (row instanceof HTMLElement ? row.dataset.promptId : ''))
    .filter(Boolean);

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
      const selected = /** @type {HTMLSelectElement | null} */ (doc().querySelector(`${PANEL} select`));
      if (selected?.value) jumpToPrompt(selected.value);
      return;
    }
    if (target.dataset.promptRevisionAction === 'clear-history') {
      const selected = /** @type {HTMLSelectElement | null} */ (doc().querySelector(`${PANEL} select`));
      if (!selected?.value) return status('Önce bir istem seç.');
      if (!root.confirm?.('Bu istemin sürüm geçmişi temizlensin mi?')) return;
      if (!api()?.removePromptRevisions?.(selected.value, storage())) return status('Sürüm geçmişi temizlenemedi.');
      api()?.mount?.();
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
