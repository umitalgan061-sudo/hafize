(function installPromptSmartInsertShortcuts(root) {
  'use strict';
  const CENTER_ID = 'promptLibrarySmartInsertCenter';
  const LIBRARY_ID = 'promptLibraryCard';
  const isTyping = (target) => {
    if (!target) return false;
    const tag = target.tagName?.toLowerCase?.();
    return tag === 'input' || tag === 'textarea' || target.isContentEditable === true;
  };

  function openCenter() {
    const center = root.document?.getElementById?.(CENTER_ID);
    if (!center) return false;
    center.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    const search = center.querySelector('[data-profile-center-search]');
    search?.focus?.();
    search?.select?.();
    return true;
  }

  function openFirstSmartInsert() {
    const button = root.document?.querySelector?.('#promptLibraryCard [data-prompt-smart-insert]');
    if (!button) return false;
    button.click();
    return true;
  }

  function toggleHistory() {
    const section = root.document?.getElementById?.('promptLibrarySmartInsertHistory');
    if (!section) return false;
    const list = section.querySelector('.prompt-smart-insert-history-list');
    const hidden = list?.hidden === true;
    if (list) list.hidden = !hidden;
    return true;
  }

  function announce(message) {
    const status = root.document?.querySelector?.('#promptLibraryCard .prompt-library-status');
    if (status) status.textContent = String(message || '').slice(0, 180);
  }

  function onKeydown(event) {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || !event.shiftKey) return;
    if (isTyping(event.target)) return;
    const key = event.key.toLowerCase();
    if (key === 'i') {
      event.preventDefault();
      announce(openFirstSmartInsert() ? 'Smart Insert açıldı.' : 'Açılacak değişkenli istem bulunamadı.');
    } else if (key === 'l') {
      event.preventDefault();
      announce(openCenter() ? 'Değişken profilleri açıldı.' : 'Profil merkezi hazır değil.');
    } else if (key === 'h') {
      event.preventDefault();
      announce(toggleHistory() ? 'Smart Insert geçmişi değiştirildi.' : 'Smart Insert geçmişi hazır değil.');
    }
  }

  function mount() {
    if (!root.document || root.HafizePromptLibrarySmartInsertShortcuts) return;
    root.document.addEventListener('keydown', onKeydown);
    root.HafizePromptLibrarySmartInsertShortcuts = Object.freeze({
      openCenter,
      openFirstSmartInsert,
      toggleHistory,
      isTyping,
      destroy: () => root.document.removeEventListener('keydown', onKeydown)
    });
  }

  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})(typeof globalThis !== 'undefined' ? globalThis : self);
