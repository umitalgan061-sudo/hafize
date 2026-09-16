(function installHafizeComposerHistoryHelp(root) {
  'use strict';
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
    // `after` void döndürür; hedefin varlığı açıkça sorulur.
    if (row) row.after(note);
    else form.append(note);
    root.HafizeComposerHistoryHelp = Object.freeze({ element: note, destroy: () => { note.remove(); delete root.HafizeComposerHistoryHelp; } });
    return root.HafizeComposerHistoryHelp;
  }
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
