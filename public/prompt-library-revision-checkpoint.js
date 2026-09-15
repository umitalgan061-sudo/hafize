(function installPromptRevisionCheckpoint(root) {
  'use strict';
  const CARD_ID = 'promptLibraryCard';
  const ACTION = 'promptRevisionCheckpoint';
  const core = () => root.HafizePromptLibrary;
  const revisions = () => root.HafizePromptLibraryRevisions;

  const button = (doc) => {
    const node = doc.createElement('button');
    node.type = 'button';
    node.className = 'soft-btn prompt-enhancement-action';
    node.textContent = 'Sürümü koru';
    node.dataset.promptRevisionCheckpoint = ACTION;
    node.setAttribute('aria-label', 'Mevcut istem sürümünü koru');
    return node;
  };

  function report(message) {
    const status = root.document?.querySelector?.(`#${CARD_ID} .prompt-library-status`);
    if (status) status.textContent = String(message).slice(0, 180);
  }

  function save(row) {
    const api = revisions();
    if (!api?.capture || !core()?.loadItems) return report('Sürüm geçmişi hazır değil.');
    const id = row?.dataset?.promptId;
    const item = id ? core().loadItems(root.localStorage).find((candidate) => candidate.id === id) : null;
    if (!item) return report('İstem bulunamadı.');
    const saved = api.capture(item, 'manual');
    report(saved ? 'Mevcut istem sürümü korundu.' : 'Bu içerik zaten geçmişte bulunuyor veya kaydedilemedi.');
  }

  function enhance() {
    const card = root.document?.getElementById?.(CARD_ID);
    if (!card) return;
    card.querySelectorAll('.prompt-item').forEach((row) => {
      const actions = row.querySelector('.prompt-item-actions');
      if (!actions || actions.querySelector(`[data-prompt-revision-checkpoint="${ACTION}"]`)) return;
      actions.append(button(root.document));
    });
  }

  function onClick(event) {
    const target = event.target?.closest?.(`[data-prompt-revision-checkpoint="${ACTION}"]`);
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    save(target.closest('.prompt-item'));
  }

  function boot() {
    const card = root.document?.getElementById?.(CARD_ID);
    if (!card || card.dataset.revisionCheckpointMounted === 'true') return;
    card.dataset.revisionCheckpointMounted = 'true';
    card.addEventListener('click', onClick, true);
    enhance();
    const observer = typeof MutationObserver === 'function' ? new MutationObserver(enhance) : null;
    observer?.observe(card, { childList: true, subtree: true });
    root.addEventListener?.('beforeunload', () => {
      observer?.disconnect?.();
      card.removeEventListener('click', onClick, true);
      delete card.dataset.revisionCheckpointMounted;
    }, { once: true });
  }

  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
