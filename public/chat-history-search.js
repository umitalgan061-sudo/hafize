(() => {
  'use strict';

  const STORAGE_KEY = 'hafize.conversations.v1';
  const SHORTCUT = Object.freeze({ key: 'f', shift: true });
  const ui = {
    history: document.querySelector('#conversationList'),
    block: document.querySelector('.history-block')
  };

  if (!ui.history || !ui.block) return;

  function readConversations() {
    try {
      const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function normalize(value) {
    return typeof value === 'string' ? value.toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').trim() : '';
  }

  function searchableText(conversation) {
    const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
    return normalize([
      conversation?.title,
      conversation?.agentId,
      ...messages.map((message) => message?.content)
    ].filter((value) => typeof value === 'string').join(' '));
  }

  function createSearchUi() {
    const section = document.createElement('section');
    section.className = 'history-search';
    section.setAttribute('aria-label', 'Sohbet geçmişinde ara');

    const label = document.createElement('label');
    label.className = 'history-search-label';
    label.htmlFor = 'conversationSearchInput';
    label.textContent = 'Sohbetlerde ara';

    const row = document.createElement('div');
    row.className = 'history-search-row';

    const input = document.createElement('input');
    input.id = 'conversationSearchInput';
    input.className = 'history-search-input';
    input.type = 'search';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.placeholder = 'Başlık veya mesaj…';
    input.maxLength = 120;
    input.setAttribute('aria-describedby', 'conversationSearchStatus');

    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'history-search-clear';
    clear.textContent = '×';
    clear.setAttribute('aria-label', 'Sohbet aramasını temizle');
    clear.hidden = true;

    row.append(input, clear);

    const status = document.createElement('div');
    status.id = 'conversationSearchStatus';
    status.className = 'history-search-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    section.append(label, row, status);
    ui.block.insertBefore(section, ui.block.querySelector('.history-head')?.nextSibling || ui.history);
    return { section, input, clear, status };
  }

  const searchUi = createSearchUi();
  let query = '';
  let refreshQueued = false;

  function rowConversationIndex() {
    return Array.from(ui.history.querySelectorAll('.conversation-row'));
  }

  function render() {
    const normalizedQuery = normalize(query);
    const stored = readConversations();
    const rows = rowConversationIndex();
    const byTitle = new Map(stored.map((conversation) => [normalize(conversation?.title), conversation]));
    let visible = 0;

    for (const row of rows) {
      const title = normalize(row.querySelector('.conversation-open')?.textContent || '');
      const conversation = byTitle.get(title);
      const haystack = conversation ? searchableText(conversation) : title;
      const matches = !normalizedQuery || haystack.includes(normalizedQuery);
      row.hidden = !matches;
      if (matches) visible += 1;
    }

    const total = rows.length;
    searchUi.clear.hidden = !normalizedQuery;
    if (!total) searchUi.status.textContent = 'Henüz sohbet yok.';
    else if (!normalizedQuery) searchUi.status.textContent = `${total} sohbet`;
    else searchUi.status.textContent = `${visible} / ${total} sohbet eşleşti`;

    let empty = ui.history.querySelector('.history-search-empty');
    if (normalizedQuery && total > 0 && visible === 0) {
      if (!empty) {
        empty = document.createElement('div');
        empty.className = 'history-search-empty';
        empty.setAttribute('role', 'status');
        ui.history.append(empty);
      }
      empty.textContent = 'Aramanla eşleşen sohbet bulunamadı.';
    } else {
      empty?.remove();
    }
  }

  function queueRender() {
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(() => {
      refreshQueued = false;
      render();
    });
  }

  searchUi.input.addEventListener('input', () => {
    query = searchUi.input.value;
    queueRender();
  });
  searchUi.input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (!searchUi.input.value) return;
      event.preventDefault();
      searchUi.input.value = '';
      query = '';
      queueRender();
    }
  });
  searchUi.clear.addEventListener('click', () => {
    searchUi.input.value = '';
    query = '';
    queueRender();
    searchUi.input.focus();
  });

  document.addEventListener('keydown', (event) => {
    const target = event.target;
    // Kısayol mod+shift+F'tir: `SHORTCUT.shift` sabitini okumak shift durumunu
    // hiç kontrol etmiyor, kısayol tarayıcının kendi Ctrl+F aramasını
    // kaçırıyordu. Karar gerçek event modifier'larına bakar.
    const hasModifier = event.ctrlKey || event.metaKey;
    if (!hasModifier || event.altKey || event.shiftKey !== SHORTCUT.shift) return;
    if (event.key.toLocaleLowerCase() !== SHORTCUT.key) return;
    if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) && target !== searchUi.input) return;
    event.preventDefault();
    searchUi.input.focus();
    searchUi.input.select();
  });

  const observer = new MutationObserver(queueRender);
  observer.observe(ui.history, { childList: true, subtree: true });
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) queueRender();
  });

  render();
})();
