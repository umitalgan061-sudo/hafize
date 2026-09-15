(function installHafizeComposerHistory(root) {
  'use strict';
  const STORAGE_KEY = 'hafize.composer-history.v1';
  const INPUT_ID = 'messageInput';
  const MAX_ITEMS = 40;
  const MAX_TEXT = 12000;
  const api = Object.freeze({
    STORAGE_KEY,
    MAX_ITEMS,
    MAX_TEXT,
    normalize(value) { return String(value ?? '').replace(/\0/g, '').slice(0, MAX_TEXT); },
    load() {
      try {
        const parsed = JSON.parse(root.localStorage?.getItem?.(STORAGE_KEY) || '[]');
        return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string' && item.trim()).map((item) => this.normalize(item)).slice(0, MAX_ITEMS) : [];
      } catch { return []; }
    },
    save(items) {
      try { root.localStorage?.setItem?.(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS))); return true; } catch { return false; }
    }
  });
  root.HafizeComposerHistory = api;

  function boot() {
    const documentRef = root.document;
    const composer = documentRef?.getElementById?.(INPUT_ID);
    if (!documentRef || !composer || composer.dataset.historyReady === 'true') return null;
    composer.dataset.historyReady = 'true';
    let items = api.load();
    let cursor = -1;
    let draft = '';
    let navigating = false;
    let composing = false;

    const normalized = (value) => api.normalize(value);
    const atEdge = () => composer.selectionStart === 0 || composer.selectionStart === composer.value.length;
    const emitInput = () => composer.dispatchEvent(new Event('input', { bubbles: true }));
    const insert = (value) => { composer.value = normalized(value); emitInput(); };
    const rememberDraft = () => { if (cursor === -1) draft = normalized(composer.value); };
    const resetNavigation = () => { if (!navigating) cursor = -1; navigating = false; };
    const add = (value) => {
      const text = normalized(value).trim();
      if (!text) return;
      items = [text, ...items.filter((item) => item !== text)].slice(0, MAX_ITEMS);
      api.save(items);
      root.dispatchEvent?.(new root.CustomEvent('hafize:composer-history-changed', { detail: { size: items.length } }));
    };
    const navigate = (direction) => {
      if (!items.length) return;
      rememberDraft();
      navigating = true;
      if (cursor === -1) cursor = direction < 0 ? 0 : items.length - 1;
      else cursor = Math.max(0, Math.min(items.length - 1, cursor + direction));
      insert(items[cursor]);
      navigating = false;
    };
    const restoreDraft = () => { cursor = -1; insert(draft); };

    const onInput = () => resetNavigation();
    const onKeydown = (event) => {
      if (event.isComposing || composing || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') || !atEdge()) return;
      if (event.key === 'ArrowUp') { event.preventDefault(); navigate(-1); return; }
      if (cursor < 0) return;
      event.preventDefault();
      if (cursor >= items.length - 1) restoreDraft(); else navigate(1);
    };
    const onComposition = (event) => { composing = event.type === 'compositionstart'; };
    const onSubmit = () => { add(composer.value); cursor = -1; draft = ''; };
    const onStorage = (event) => { if (event.key === STORAGE_KEY) items = api.load(); };

    composer.addEventListener('input', onInput);
    composer.addEventListener('keydown', onKeydown);
    composer.addEventListener('compositionstart', onComposition);
    composer.addEventListener('compositionend', onComposition);
    composer.closest('form')?.addEventListener('submit', onSubmit);
    root.addEventListener?.('storage', onStorage);

    const controller = Object.freeze({
      getItems: () => items.slice(),
      add,
      clear: () => { items = []; api.save(items); },
      navigate,
      getCursor: () => cursor,
      destroy: () => {
        composer.removeEventListener('input', onInput);
        composer.removeEventListener('keydown', onKeydown);
        composer.removeEventListener('compositionstart', onComposition);
        composer.removeEventListener('compositionend', onComposition);
        composer.closest('form')?.removeEventListener('submit', onSubmit);
        root.removeEventListener?.('storage', onStorage);
        delete composer.dataset.historyReady;
        delete root.HafizeComposerHistoryController;
      }
    });
    root.HafizeComposerHistoryController = controller;
    return controller;
  }

  root.HafizeComposerHistory.mount = boot;
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
