(function installPromptLibraryFillPrivacy(root) {
  'use strict';
  const PREFS_KEY = 'hafize.prompt-library.fill.v1';
  const PRESETS_KEY = 'hafize.prompt-library.fill.presets.v1';
  const DIALOG_ID = 'promptLibraryFillDialog';
  const MARKER = 'data-hafize-fill-privacy';
  const MAX_VALUE = 1000;

  const make = (tag, textValue, className) => { const node = root.document.createElement(tag); if (className) node.className = className; if (textValue !== undefined) node.textContent = textValue; return node; };
  const button = (label) => { const node = make('button', label, 'mini-btn'); node.type = 'button'; return node; };
  const read = (key, fallback) => { try { const value = JSON.parse(root.localStorage?.getItem(key) || JSON.stringify(fallback)); return value && typeof value === 'object' ? value : fallback; } catch { return fallback; } };
  const write = (key, value) => { try { root.localStorage?.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };

  function itemId(dialog) { return dialog?.dataset?.promptId || ''; }
  function clearRemembered(dialog) {
    const data = read(PREFS_KEY, {});
    const id = itemId(dialog);
    if (id) { delete data[id]; write(PREFS_KEY, data); }
  }
  function clearPresets(dialog) {
    const data = read(PRESETS_KEY, {});
    const id = itemId(dialog);
    if (id) { delete data[id]; write(PRESETS_KEY, data); }
  }
  function removeEmptyRemembered() {
    const data = read(PREFS_KEY, {});
    for (const [id, values] of Object.entries(data)) {
      if (!values || typeof values !== 'object' || !Object.values(values).some((value) => typeof value === 'string' && value.slice(0, MAX_VALUE).trim())) delete data[id];
    }
    write(PREFS_KEY, data);
    return Object.keys(data).length;
  }
  function clearAll() { write(PREFS_KEY, {}); write(PRESETS_KEY, {}); }

  function bind(dialog) {
    if (!dialog || dialog.hasAttribute(MARKER)) return;
    dialog.setAttribute(MARKER, 'true');
    const tools = make('details', undefined, 'prompt-library-fill-privacy');
    const summary = make('summary', 'Yerel değerler');
    const text = make('p', 'Hatırlanan alanlar ve presetler yalnızca bu cihazın tarayıcı storage alanında tutulur.', 'prompt-library-fill-privacy-copy');
    const current = button('Bu promptun hatırlanan değerlerini temizle');
    const currentPresets = button('Bu promptun presetlerini temizle');
    const compact = button('Boş hatırlamaları temizle');
    const all = button('Tüm smart-fill verisini temizle');
    const status = make('span', '', 'prompt-library-fill-privacy-status');
    tools.append(summary, text, current, currentPresets, compact, all, status);
    dialog.querySelector('.prompt-library-fill-remember')?.after(tools);
    current.addEventListener('click', () => { if (!root.confirm?.('Bu promptun hatırlanan değerleri silinsin mi?')) return; clearRemembered(dialog); status.textContent = 'Hatırlanan değerler temizlendi.'; });
    currentPresets.addEventListener('click', () => { if (!root.confirm?.('Bu promptun presetleri silinsin mi?')) return; clearPresets(dialog); root.document.dispatchEvent?.(new Event('hafize:prompt-library-fill-presets-refresh')); status.textContent = 'Presetler temizlendi.'; });
    compact.addEventListener('click', () => { removeEmptyRemembered(); status.textContent = 'Boş hatırlamalar temizlendi.'; });
    all.addEventListener('click', () => { if (!root.confirm?.('Tüm smart-fill hatırlama ve preset verileri silinsin mi?')) return; clearAll(); status.textContent = 'Tüm yerel smart-fill verisi temizlendi.'; });
  }
  function boot() {
    if (!root.document?.body) return;
    const observer = new MutationObserver(() => bind(root.document.getElementById(DIALOG_ID)));
    observer.observe(root.document.body, { childList: true, subtree: true });
    root.addEventListener?.('beforeunload', () => observer.disconnect(), { once: true });
    bind(root.document.getElementById(DIALOG_ID));
  }
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
  root.HafizePromptLibraryFillPrivacy = Object.freeze({ read, write, clearRemembered, clearPresets, removeEmptyRemembered, clearAll, bind });
})(typeof globalThis !== 'undefined' ? globalThis : self);
