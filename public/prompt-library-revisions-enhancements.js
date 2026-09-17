(function installPromptRevisionEnhancements(root) {
  'use strict';
  const PANEL = '#promptLibraryRevisions';
  let booted = false;
  let observer = null;
  const listeners = [];
  const doc = () => root.document;
  const api = () => root.HafizePromptLibraryRevisions;
  const storage = () => root.localStorage;

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

  /** Tells the revisions panel to repaint, the way another tab would. */
  function repaintPanel() {
    const key = api()?.REVISION_KEY;
    if (!key) return;
    const detail = { key, newValue: storage()?.getItem?.(key) ?? null, storageArea: storage() };
    try {
      if (typeof root.StorageEvent === 'function') {
        root.dispatchEvent(new root.StorageEvent('storage', detail));
        return;
      }
      // Without the constructor the panel still only needs `event.key`.
      const event = new root.Event('storage');
      Object.defineProperty(event, 'key', { value: key });
      root.dispatchEvent(event);
    } catch {
      // The revisions are deleted either way; only the live repaint is lost.
    }
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
      // The panel repaints on a `storage` event carrying its own key. A bare
      // `Event('storage')` has no key, so it was filtered out and the panel
      // kept listing the revisions that had just been deleted.
      repaintPanel();
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
