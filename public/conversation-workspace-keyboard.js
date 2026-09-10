(() => {
  'use strict';

  const MODIFIER = 'mod';
  const SHORTCUTS = Object.freeze({
    selectAll: { key: 'a', shift: true },
    clearSelection: { key: 'x', shift: true },
    focusSearch: { key: 'u', shift: true },
    escape: { key: 'Escape', shift: false }
  });
  const ui = {
    workspace: document.querySelector('.conversation-workspace'),
    search: document.querySelector('#conversationWorkspaceSearch'),
    selectAll: document.querySelector('.conversation-workspace-actions .workspace-ghost'),
    clearSelection: document.querySelectorAll('.conversation-workspace-actions .workspace-ghost')?.[1],
    status: document.querySelector('#conversationWorkspaceStatus')
  };

  if (!ui.workspace || !ui.search) return;

  function isTextEditingTarget(target) {
    if (!target || typeof target !== 'object') return false;
    const tagName = String(target.tagName || '').toUpperCase();
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName)) return true;
    return target.isContentEditable === true;
  }

  function isModifierPressed(event) {
    return Boolean(event?.ctrlKey || event?.metaKey);
  }

  function matches(event, definition) {
    if (!event || !definition) return false;
    if (!isModifierPressed(event)) return false;
    if (Boolean(event.altKey)) return false;
    if (Boolean(event.shiftKey) !== Boolean(definition.shift)) return false;
    return String(event.key || '').toLowerCase() === definition.key.toLowerCase();
  }

  function announce(text) {
    if (!ui.status || !text) return;
    ui.status.textContent = text;
  }

  function clickControl(control, message) {
    if (!control || control.disabled) return false;
    control.click();
    announce(message);
    return true;
  }

  function focusSearch() {
    ui.search.focus();
    ui.search.select();
    announce('Sohbet çalışma alanı araması odakta.');
  }

  function clearSearchOnEscape(event) {
    if (!matchesEscape(event) || document.activeElement !== ui.search) return false;
    if (!ui.search.value) return false;
    event.preventDefault();
    ui.search.value = '';
    ui.search.dispatchEvent(new Event('input', { bubbles: true }));
    announce('Çalışma alanı araması temizlendi.');
    return true;
  }

  function matchesEscape(event) {
    return String(event?.key || '') === SHORTCUTS.escape.key && !event.ctrlKey && !event.metaKey && !event.altKey;
  }

  function onKeydown(event) {
    if (!event || event.isComposing) return;
    if (clearSearchOnEscape(event)) return;
    if (!isModifierPressed(event)) return;

    const editing = isTextEditingTarget(event.target);
    if (editing && event.target !== ui.search) return;

    if (matches(event, SHORTCUTS.selectAll)) {
      event.preventDefault();
      clickControl(ui.selectAll, 'Görünen sohbetler seçildi.');
      return;
    }
    if (matches(event, SHORTCUTS.clearSelection)) {
      event.preventDefault();
      clickControl(ui.clearSelection, 'Sohbet seçimi temizlendi.');
      return;
    }
    if (matches(event, SHORTCUTS.focusSearch)) {
      event.preventDefault();
      focusSearch();
    }
  }

  function createHint() {
    if (ui.workspace.querySelector('.conversation-workspace-shortcuts')) return;
    const hint = document.createElement('div');
    hint.className = 'conversation-workspace-shortcuts';
    hint.setAttribute('role', 'note');
    hint.setAttribute('aria-label', 'Çalışma alanı klavye kısayolları');

    const heading = document.createElement('span');
    heading.className = 'workspace-shortcuts-title';
    heading.textContent = 'Kısayollar';

    const list = document.createElement('div');
    list.className = 'workspace-shortcuts-list';

    const rows = [
      ['Ctrl / ⌘ + Shift + A', 'Görünenleri seç'],
      ['Ctrl / ⌘ + Shift + X', 'Seçimi temizle'],
      ['Ctrl / ⌘ + Shift + U', 'Aramaya geç'],
      ['Esc', 'Aramayı temizle']
    ];

    for (const [keyText, description] of rows) {
      const item = document.createElement('span');
      item.className = 'workspace-shortcut-item';
      const key = document.createElement('kbd');
      key.textContent = keyText;
      const label = document.createElement('span');
      label.textContent = description;
      item.append(key, label);
      list.append(item);
    }

    hint.append(heading, list);
    ui.workspace.append(hint);
  }

  function refreshControls() {
    const selected = document.querySelectorAll('.workspace-row-check:checked').length;
    if (selected === 0) {
      ui.clearSelection?.setAttribute('aria-disabled', 'true');
    } else {
      ui.clearSelection?.removeAttribute('aria-disabled');
    }
  }

  const observer = new MutationObserver(() => {
    refreshControls();
    createHint();
  });
  observer.observe(ui.workspace, { childList: true, subtree: true });

  document.addEventListener('keydown', onKeydown);
  ui.search.addEventListener('focus', () => announce('Sohbet araması. Esc ile temizleyebilirsin.'));
  createHint();
  refreshControls();

  window.HafizeConversationWorkspaceKeyboard = Object.freeze({
    SHORTCUTS,
    isTextEditingTarget,
    isModifierPressed,
    matches,
    matchesEscape,
    focusSearch
  });
})();
