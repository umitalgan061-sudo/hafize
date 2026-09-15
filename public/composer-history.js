(function installHafizeComposerHistory(root) {
  'use strict';
  const STORAGE_KEY = 'hafize.composer-history.v1';
  const SETTINGS_KEY = 'hafize.composer-history.settings.v1';
  const INPUT_ID = 'messageInput';
  const MAX_ITEMS = 40;
  const MAX_TEXT = 12000;
  const RETENTION_VALUES = Object.freeze([0, 10, 20, 40]);
  const normalize = (value) => String(value ?? '').replace(/\0/g, '').slice(0, MAX_TEXT);
  const loadSettings = () => {
    try {
      const data = JSON.parse(root.localStorage?.getItem?.(SETTINGS_KEY) || '{}');
      return { enabled: data.enabled !== false, maxItems: RETENTION_VALUES.includes(data.maxItems) ? data.maxItems : MAX_ITEMS };
    } catch { return { enabled: true, maxItems: MAX_ITEMS }; }
  };
  const saveSettings = (settings) => {
    const next = { enabled: settings?.enabled !== false, maxItems: RETENTION_VALUES.includes(settings?.maxItems) ? settings.maxItems : MAX_ITEMS };
    try {
      root.localStorage?.setItem?.(SETTINGS_KEY, JSON.stringify(next));
      if (!next.enabled || next.maxItems === 0) root.localStorage?.removeItem?.(STORAGE_KEY);
      return true;
    } catch { return false; }
  };
  function boot() {
    const documentRef = root.document;
    const composer = documentRef?.getElementById?.(INPUT_ID);
    if (!documentRef || !composer || composer.dataset.historyReady === 'true') return null;
    composer.dataset.historyReady = 'true';
    const api = root.HafizeComposerHistory;
    let settings = api.loadSettings();
    let items = api.load(); let cursor = -1; let draft = ''; let navigating = false; let composing = false;
    const emitInput = () => composer.dispatchEvent(new Event('input', { bubbles: true }));
    const insert = (value) => { composer.value = normalize(value); emitInput(); };
    const rememberDraft = () => { if (cursor === -1) draft = normalize(composer.value); };
    const resetNavigation = () => { if (!navigating) cursor = -1; navigating = false; };
    const refresh = () => { settings = api.loadSettings(); items = api.load(); if (cursor >= items.length) cursor = -1; root.dispatchEvent?.(new root.CustomEvent('hafize:composer-history-changed', { detail: { size: items.length } })); };
    const add = (value) => {
      const text = normalize(value).trim();
      if (!text || !settings.enabled || settings.maxItems === 0) return;
      items = [text, ...items.filter((item) => item !== text)].slice(0, settings.maxItems);
      api.save(items);
      root.dispatchEvent?.(new root.CustomEvent('hafize:composer-history-changed', { detail: { size: items.length } }));
    };
    const navigate = (direction) => {
      if (!items.length) return;
      rememberDraft(); navigating = true;
      if (cursor === -1) cursor = direction < 0 ? 0 : items.length - 1; else cursor = Math.max(0, Math.min(items.length - 1, cursor + direction));
      insert(items[cursor]); navigating = false;
    };
    const restoreDraft = () => { cursor = -1; insert(draft); };
    const onInput = () => resetNavigation();
    const onKeydown = (event) => {
      if (event.isComposing || composing || !settings.enabled || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
      if (composer.selectionStart !== 0 && composer.selectionStart !== composer.value.length) return;
      if (event.key === 'ArrowUp') { event.preventDefault(); navigate(-1); return; }
      if (cursor < 0) return;
      event.preventDefault(); if (cursor >= items.length - 1) restoreDraft(); else navigate(1);
    };
    const onComposition = (event) => { composing = event.type === 'compositionstart'; };
    const onSubmit = () => { add(composer.value); cursor = -1; draft = ''; };
    const onStorage = (event) => { if (event.key === STORAGE_KEY || event.key === SETTINGS_KEY) refresh(); };
    const onSettings = (event) => { settings = api.loadSettings(); items = api.load(); if (event?.detail?.clear) { items = []; api.save(items); } root.dispatchEvent?.(new root.CustomEvent('hafize:composer-history-changed', { detail: { size: items.length } })); };
    composer.addEventListener('input', onInput); composer.addEventListener('keydown', onKeydown); composer.addEventListener('compositionstart', onComposition); composer.addEventListener('compositionend', onComposition);
    composer.closest('form')?.addEventListener('submit', onSubmit); root.addEventListener?.('storage', onStorage); root.addEventListener?.('hafize:composer-history-settings-changed', onSettings);
    const controller = Object.freeze({
      getItems: () => items.slice(), add, navigate, getCursor: () => cursor,
      clear: () => { items = []; api.save(items); root.dispatchEvent?.(new root.CustomEvent('hafize:composer-history-changed', { detail: { size: 0 } })); },
      getSettings: () => ({ ...settings }),
      setSettings: (next) => { const merged = { ...settings, ...next }; api.saveSettings(merged); settings = api.loadSettings(); items = api.load(); if (!settings.enabled || settings.maxItems === 0) items = []; root.dispatchEvent?.(new root.CustomEvent('hafize:composer-history-settings-changed', { detail: { ...settings } })); },
      destroy: () => { composer.removeEventListener('input', onInput); composer.removeEventListener('keydown', onKeydown); composer.removeEventListener('compositionstart', onComposition); composer.removeEventListener('compositionend', onComposition); composer.closest('form')?.removeEventListener('submit', onSubmit); root.removeEventListener?.('storage', onStorage); root.removeEventListener?.('hafize:composer-history-settings-changed', onSettings); delete composer.dataset.historyReady; delete root.HafizeComposerHistoryController; }
    });
    root.HafizeComposerHistoryController = controller;
    return controller;
  }
  const api = Object.freeze({ STORAGE_KEY, SETTINGS_KEY, MAX_ITEMS, MAX_TEXT, RETENTION_VALUES, normalize, loadSettings, saveSettings, mount: boot,
    load() {
      try {
        const settings = loadSettings();
        if (!settings.enabled || settings.maxItems === 0) return [];
        const parsed = JSON.parse(root.localStorage?.getItem?.(STORAGE_KEY) || '[]');
        return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string' && item.trim()).map(normalize).slice(0, Math.min(MAX_ITEMS, settings.maxItems)) : [];
      } catch { return []; }
    },
    save(items) {
      const settings = loadSettings();
      if (!settings.enabled || settings.maxItems === 0) {
        try { root.localStorage?.removeItem?.(STORAGE_KEY); return true; } catch { return false; }
      }
      try { root.localStorage?.setItem?.(STORAGE_KEY, JSON.stringify(items.slice(0, Math.min(MAX_ITEMS, settings.maxItems)))); return true; } catch { return false; }
    }
  });
  root.HafizeComposerHistory = api;
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
