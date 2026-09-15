(function installHafizeComposerHistoryHelp(root) {
  'use strict';
  function loadAsset(doc, tag, href) {
    if (doc.querySelector(`[data-hafize-asset="${href}"]`)) return;
    const node = doc.createElement(tag);
    node.dataset.hafizeAsset = href;
    if (tag === 'link') { node.rel = 'stylesheet'; node.href = href; }
    else { node.src = href; node.defer = true; }
    doc.head?.append(node);
  }
  function boot() {
    const doc = root.document;
    const form = doc?.getElementById?.('composer');
    const composer = doc?.getElementById?.('messageInput');
    if (!doc || !form || !composer || doc.getElementById('composerHistoryHelp')) return null;
    const note = doc.createElement('small');
    note.id = 'composerHistoryHelp';
    note.className = 'composer-history-help';
    note.textContent = 'Geçmiş: ↑ / ↓ · Panel: Ctrl/⌘ + Shift + H';
    note.setAttribute('aria-label', 'Gönderim geçmişi kısayolları: yukarı ve aşağı oklarla gezin, kontrol veya komut artı shift artı H ile paneli aç');
    const row = form.querySelector('.composer-row');
    row?.after(note) || form.append(note);
    loadAsset(doc, 'link', '/message-markdown.css');
    loadAsset(doc, 'script', '/message-markdown.js');
    loadAsset(doc, 'script', '/message-markdown-enhancement.js');
    root.HafizeComposerHistoryHelp = Object.freeze({ element: note, destroy: () => { note.remove(); delete root.HafizeComposerHistoryHelp; } });
    return root.HafizeComposerHistoryHelp;
  }
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
