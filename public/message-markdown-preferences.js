(function installHafizeMarkdownPreferences(root) {
  'use strict';
  const STORAGE_KEY = 'hafize.markdown-rendering.v1';
  const EVENT = 'hafize:markdown-rendering-preference';
  let node = null;

  function enabled() {
    try { return root.localStorage?.getItem(STORAGE_KEY) !== 'off'; } catch { return true; }
  }
  function save(value) {
    try { root.localStorage?.setItem(STORAGE_KEY, value ? 'on' : 'off'); } catch { /* local-only preference best effort */ }
  }
  function dispatch(value) { root.dispatchEvent?.(new CustomEvent(EVENT, { detail: { enabled: value } })); }
  function install() {
    const doc = root.document;
    const note = doc?.getElementById?.('composerHistoryHelp');
    if (!doc || !note || node) return;
    node = doc.createElement('button');
    node.type = 'button'; node.className = 'composer-history-help-toggle';
    node.addEventListener('click', () => { const next = !enabled(); save(next); update(); dispatch(next); });
    note.append(doc.createTextNode(' · '), node);
    update();
  }
  function update() {
    if (!node) return;
    const value = enabled(); node.textContent = value ? 'Biçimlendirme açık' : 'Biçimlendirme kapalı';
    node.setAttribute('aria-pressed', String(value));
    node.setAttribute('aria-label', value ? 'Markdown biçimlendirmesini kapat' : 'Markdown biçimlendirmesini aç');
  }
  root.HafizeMarkdownPreferences = Object.freeze({ STORAGE_KEY, EVENT, enabled });
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})(typeof globalThis !== 'undefined' ? globalThis : self);
