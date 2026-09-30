(function installPromptSmartFillHints(root) {
  'use strict';
  const CARD_ID = 'promptLibraryCard';
  const MAX_VARIABLES = 12;

  function core() { return root.HafizePromptLibrary; }
  function variables(item) {
    return core()?.extractVariables?.(item?.body || '')?.slice(0, MAX_VARIABLES) || [];
  }

  function paint() {
    const doc = root.document;
    const card = doc?.getElementById?.(CARD_ID);
    if (!doc || !card) return;
    const items = core()?.loadItems?.(root.localStorage) || [];
    const byId = new Map(items.map((item) => [item.id, item]));
    card.querySelectorAll('.prompt-item').forEach((row) => {
      const id = row.dataset.promptId;
      const meta = row.querySelector('.prompt-item-meta');
      const item = byId.get(id);
      if (!meta || !item) return;
      meta.querySelectorAll('[data-smart-fill-hint]').forEach((node) => node.remove());
      const count = variables(item).length;
      if (!count) return;
      const hint = doc.createElement('span');
      hint.className = 'prompt-item-tag';
      hint.dataset.smartFillHint = 'true';
      hint.textContent = `${count} değişken`;
      hint.setAttribute('title', 'Kullan düğmesi değişkenleri doldurmanıza yardımcı olur.');
      meta.append(' ', hint);
    });
  }

  function boot() {
    const card = root.document?.getElementById?.(CARD_ID);
    if (!card || card.dataset.smartFillHintsReady === 'true') return;
    card.dataset.smartFillHintsReady = 'true';
    const observer = new MutationObserver(() => paint());
    observer.observe(card, { childList: true, subtree: true });
    root.addEventListener?.('storage', (event) => {
      if (event.key === core()?.STORAGE_KEY) paint();
    });
    paint();
  }

  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
