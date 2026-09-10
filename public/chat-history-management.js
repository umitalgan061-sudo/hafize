(() => {
  'use strict';

  const STORAGE_KEY = 'hafize.conversations.v1';
  const LIST_SELECTOR = '#conversationList';
  const ROW_SELECTOR = '.conversation-row';
  const MANAGE_CLASS = 'history-manage';
  const MANAGE_BUTTON = 'history-manage-btn';
  const RENAME_CLASS = 'history-rename';
  const MAX_TITLE_LENGTH = 80;

  const ui = {
    list: document.querySelector(LIST_SELECTOR),
    toast: document.querySelector('#toast')
  };

  if (!ui.list) return;

  function announce(message) {
    if (!ui.toast || !message) return;
    ui.toast.textContent = message;
    ui.toast.classList.remove('hidden');
    window.clearTimeout(announce.timeoutId);
    announce.timeoutId = window.setTimeout(() => ui.toast.classList.add('hidden'), 2600);
  }

  function readHistory() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function writeHistory(conversations) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations.slice(0, 30)));
      return true;
    } catch {
      announce('Sohbet geçmişi bu cihazda güncellenemedi.');
      return false;
    }
  }

  function findConversation(id) {
    return readHistory().find((conversation) => conversation?.id === id) || null;
  }

  function mutateConversation(id, mutate) {
    const history = readHistory();
    const conversation = history.find((item) => item?.id === id);
    if (!conversation) return false;
    mutate(conversation);
    return writeHistory(history);
  }

  function getRowId(row) {
    return row?.querySelector?.('.conversation-open')?.dataset?.conversationId || '';
  }

  function assignMissingIds(rows, history) {
    rows.forEach((row, index) => {
      if (getRowId(row)) return;
      const candidate = history[index];
      if (candidate?.id) row.querySelector('.conversation-open')?.setAttribute('data-conversation-id', candidate.id);
    });
  }

  function applyTitle(row, conversation) {
    const button = row.querySelector('.conversation-open');
    if (!button || typeof conversation?.title !== 'string') return;
    button.dataset.conversationId = conversation.id;
    button.classList.add('conversation-title');
    button.textContent = conversation.title || 'Yeni sohbet';
    button.title = conversation.title || 'Yeni sohbet';
  }

  function createManagementButton(text, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = MANAGE_BUTTON;
    button.textContent = text;
    button.setAttribute('aria-label', label);
    return button;
  }

  function closeRename(row) {
    row.querySelector(`.${RENAME_CLASS}`)?.remove();
  }

  function openRename(row, conversation) {
    closeRename(row);
    const form = document.createElement('div');
    form.className = RENAME_CLASS;
    form.setAttribute('role', 'group');
    form.setAttribute('aria-label', 'Sohbet adını düzenle');

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = MAX_TITLE_LENGTH;
    input.value = conversation.title || 'Yeni sohbet';
    input.setAttribute('aria-label', 'Yeni sohbet adı');

    const actions = document.createElement('div');
    actions.className = 'history-rename-actions';
    const cancel = createManagementButton('Vazgeç', 'Sohbet adını değiştirmeyi iptal et');
    const save = createManagementButton('Kaydet', 'Sohbet adını kaydet');
    save.classList.add('primary');

    const commit = () => {
      const nextTitle = input.value.trim().replace(/\s+/g, ' ').slice(0, MAX_TITLE_LENGTH);
      if (!nextTitle) return announce('Sohbet adı boş olamaz.');
      if (!mutateConversation(conversation.id, (item) => { item.title = nextTitle; })) return;
      applyTitle(row, { ...conversation, title: nextTitle });
      closeRename(row);
      announce('Sohbet adı güncellendi.');
    };

    cancel.addEventListener('click', () => closeRename(row));
    save.addEventListener('click', commit);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); commit(); }
      if (event.key === 'Escape') { event.preventDefault(); closeRename(row); }
    });

    actions.append(cancel, save);
    form.append(input, actions);
    row.append(form);
    input.focus();
    input.select();
  }

  function decorateRow(row, conversation) {
    if (!row || !conversation?.id) return;
    const open = row.querySelector('.conversation-open');
    if (!open) return;
    open.dataset.conversationId = conversation.id;
    row.classList.toggle('pinned', conversation.pinned === true);
    applyTitle(row, conversation);
    row.querySelector(`.${MANAGE_CLASS}`)?.remove();

    const manage = document.createElement('div');
    manage.className = MANAGE_CLASS;
    manage.setAttribute('aria-label', 'Sohbet işlemleri');

    const pin = createManagementButton(conversation.pinned === true ? '◆' : '◇',
      conversation.pinned === true ? 'Sohbet sabitlemesini kaldır' : 'Sohbeti sabitle');
    pin.setAttribute('aria-pressed', String(conversation.pinned === true));
    pin.title = conversation.pinned === true ? 'Sabitlemeyi kaldır' : 'Sohbeti sabitle';

    const rename = createManagementButton('✎', 'Sohbet adını değiştir');
    rename.title = 'Sohbet adını değiştir';

    pin.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const current = findConversation(conversation.id);
      const nextPinned = !Boolean(current?.pinned);
      if (!mutateConversation(conversation.id, (item) => { item.pinned = nextPinned; })) return;
      sync();
      announce(nextPinned ? 'Sohbet sabitlendi.' : 'Sohbet sabitlemesi kaldırıldı.');
    });

    rename.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const current = findConversation(conversation.id);
      if (current) openRename(row, current);
    });

    manage.append(pin, rename);
    row.append(manage);
  }

  function sortPinnedRows() {
    const rows = Array.from(ui.list.querySelectorAll(ROW_SELECTOR));
    rows.sort((a, b) => Number(b.classList.contains('pinned')) - Number(a.classList.contains('pinned')));
    rows.forEach((row) => ui.list.append(row));
  }

  function sync() {
    const history = readHistory();
    if (!history.length) return;
    const rows = Array.from(ui.list.querySelectorAll(ROW_SELECTOR));
    assignMissingIds(rows, history);
    const byId = new Map(history.map((conversation) => [conversation.id, conversation]));
    for (const row of rows) {
      const conversation = byId.get(getRowId(row));
      if (conversation) decorateRow(row, conversation);
    }
    sortPinnedRows();
  }

  const observer = new MutationObserver(() => sync());
  observer.observe(ui.list, { childList: true, subtree: true });
  sync();

  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) sync();
  });
})();
