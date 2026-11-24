/**
 * TypeScript-first frontend migration wave.
 * The browser/global contract is intentionally preserved during the migration.
 */
// @ts-nocheck
import {normalizeSearch,searchHistory,nextSearchIndex} from './history-search-core.ts';
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

    const nav=document.createElement('div');nav.className='history-search-nav';nav.hidden=true;
    const previous=document.createElement('button'),next=document.createElement('button');
    previous.type=next.type='button';previous.textContent='↑ Önceki';next.textContent='Sonraki ↓';
    previous.setAttribute('aria-label','Önceki eşleşen sohbet');next.setAttribute('aria-label','Sonraki eşleşen sohbet');
    const position=document.createElement('span');position.setAttribute('role','status');nav.append(previous,next,position);
    section.append(label, row, status,nav);
    ui.block.insertBefore(section, ui.block.querySelector('.history-head')?.nextSibling || ui.history);
    return { section, input, clear, status,nav,previous,next,position };
  }

  const searchUi = createSearchUi();
  let query = '';
  let refreshQueued = false;
  let selectedId='';

  function rowConversationIndex() {
    return Array.from(ui.history.querySelectorAll('.conversation-row'));
  }

  function render() {
    const normalizedQuery = normalizeSearch(query);
    const rows = rowConversationIndex();
    const result=normalizedQuery?searchHistory(readConversations(),query):{hits:new Map(),partial:false};
    let visible=0;
    for(const row of rows){
      const open=row.querySelector('.conversation-open');
      const id=row.dataset.conversationId||open?.dataset.conversationId||'';
      const hit=result.hits.get(id);
      const matches=!normalizedQuery||Boolean(hit)||(!id&&normalizeSearch(open?.textContent).includes(normalizedQuery));
      row.hidden=!matches;
      if(matches)visible++;
      let snippet=row.querySelector('.history-search-snippet');
      const value=hit?.snippet||'';
      if(value&&!snippet){snippet=document.createElement('small');snippet.className='history-search-snippet';row.append(snippet);}
      if(snippet){if(value){if(snippet.textContent!==value)snippet.textContent=value;}else snippet.remove();}
    }
    const total=rows.length;
    const nextStatus=!total?'Henüz sohbet yok.':!normalizedQuery?total+' sohbet':visible+' / '+total+' sohbet eşleşti'+(result.partial?' · Arama sınırına ulaşıldı.':'');
    searchUi.clear.hidden=!normalizedQuery;
    if(searchUi.status.textContent!==nextStatus)searchUi.status.textContent=nextStatus;
    const targets=rows.filter(row=>!row.hidden);
    const selected=targets.findIndex(row=>row.dataset.conversationId===selectedId);
    searchUi.nav.hidden=!normalizedQuery;
    searchUi.previous.disabled=searchUi.next.disabled=!targets.length;
    searchUi.position.textContent=selected>=0?(selected+1)+' / '+targets.length:'';
    let empty = ui.history.querySelector('.history-search-empty');
    if (normalizedQuery && total > 0 && visible === 0) {
      if (!empty) {
        empty = document.createElement('div');
        empty.className = 'history-search-empty';
        empty.setAttribute('role', 'status');
        ui.history.append(empty);
      }
      const emptyText = result.partial?'İncelenen bölümde eşleşme bulunamadı; arama sınırı aşıldı.':'Aramanla eşleşen sohbet bulunamadı.';
      if (empty.textContent !== emptyText) empty.textContent = emptyText;
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

  function move(direction){
    const rows=rowConversationIndex().filter(row=>!row.hidden);
    const index=nextSearchIndex(rows.findIndex(row=>row.dataset.conversationId===selectedId),rows.length,direction);
    if(index<0)return;
    selectedId=rows[index].dataset.conversationId||'';
    rows[index].querySelector('.conversation-open')?.focus();
    searchUi.position.textContent=(index+1)+' / '+rows.length;
  }
  searchUi.previous.addEventListener('click',()=>move(-1));searchUi.next.addEventListener('click',()=>move(1));
  searchUi.input.addEventListener('input', () => {
    selectedId='';query = searchUi.input.value;
    queueRender();
  });
  searchUi.input.addEventListener('keydown', (event) => {
    if((event.key==='ArrowDown'||event.key==='ArrowUp')&&normalizeSearch(query)){event.preventDefault();render();move(event.key==='ArrowDown'?1:-1);return;}
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
    if (!event.ctrlKey && !event.metaKey) return;
    if (event.altKey || event.key.toLocaleLowerCase() !== SHORTCUT.key || event.shiftKey !== SHORTCUT.shift) return;
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
