(() => {
  'use strict';

  const STORAGE_KEY = 'hafize.message-workspace.v1';
  const STORAGE_EVENT = 'hafize:message-workspace-changed';
  const MAX_RECORDS = 240;
  const MAX_NOTE = 600;
  const MAX_TAG = 24;
  const MAX_TAGS = 8;
  const MAX_QUERY = 120;
  const MAX_EXPORT = 100;
  const VALID_FEEDBACK = new Set(['up', 'down', '']);
  const VALID_SORTS = new Set(['newest', 'oldest', 'feedback', 'notes']);
  const DEFAULT_STATE = Object.freeze({ query: '', filter: 'all', sort: 'newest', selected: [] });
  const FILTERS = new Set(['all', 'saved', 'feedback', 'notes', 'user', 'assistant', 'tag']);

  const ui = {
    messages: document.querySelector('#messages'),
    rail: document.querySelector('.utility-rail'),
    toast: document.querySelector('#toast')
  };
  if (!ui.messages || !ui.rail) return;

  const runtime = {
    records: loadRecords(),
    state: loadState(),
    observer: null,
    refreshTimer: 0,
    toastTimer: 0,
    panel: null,
    search: null,
    filter: null,
    sort: null,
    status: null,
    resultList: null,
    clearButton: null,
    exportButton: null,
    selectionButton: null,
    selectionClearButton: null
  };

  function uid() {
    return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function cleanText(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function cleanTag(value) {
    return cleanText(value).replace(/^#+/, '').slice(0, MAX_TAG);
  }

  function cleanNote(value) {
    return String(value ?? '').replace(/\r\n?/g, '\n').trim().slice(0, MAX_NOTE);
  }

  function normalizeFeedback(value) {
    return VALID_FEEDBACK.has(value) ? value : '';
  }

  function normalizeRecord(value) {
    if (!value || typeof value !== 'object') return null;
    if (typeof value.conversationId !== 'string' || !value.conversationId) return null;
    if (typeof value.messageId !== 'string' || !value.messageId) return null;
    const tags = Array.isArray(value.tags)
      ? [...new Set(value.tags.map(cleanTag).filter(Boolean))].slice(0, MAX_TAGS)
      : [];
    return {
      id: typeof value.id === 'string' && value.id ? value.id.slice(0, 120) : `${value.conversationId}:${value.messageId}`,
      conversationId: value.conversationId.slice(0, 120),
      messageId: value.messageId.slice(0, 120),
      saved: value.saved === true,
      feedback: normalizeFeedback(value.feedback),
      note: cleanNote(value.note),
      tags,
      createdAt: validDate(value.createdAt) ? new Date(value.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: validDate(value.updatedAt) ? new Date(value.updatedAt).toISOString() : new Date().toISOString()
    };
  }

  function validDate(value) {
    const date = new Date(value || '');
    return Number.isFinite(date.getTime());
  }

  function loadRecords(storage = localStorage) {
    try {
      const raw = JSON.parse(storage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(raw)) return [];
      const seen = new Set();
      return raw.map(normalizeRecord).filter((record) => {
        if (!record || seen.has(record.id)) return false;
        seen.add(record.id);
        return record.saved || record.feedback || record.note || record.tags.length;
      }).slice(0, MAX_RECORDS);
    } catch {
      return [];
    }
  }

  function normalizeState(value) {
    if (!value || typeof value !== 'object') return { ...DEFAULT_STATE, selected: [] };
    return {
      query: typeof value.query === 'string' ? cleanText(value.query).toLocaleLowerCase('tr-TR').slice(0, MAX_QUERY) : '',
      filter: FILTERS.has(value.filter) ? value.filter : 'all',
      sort: VALID_SORTS.has(value.sort) ? value.sort : 'newest',
      selected: Array.isArray(value.selected) ? value.selected.filter((id) => typeof id === 'string').slice(0, MAX_EXPORT) : []
    };
  }

  function loadState(storage = localStorage) {
    try {
      return normalizeState(JSON.parse(storage.getItem(`${STORAGE_KEY}.state`) || '{}'));
    } catch {
      return { ...DEFAULT_STATE, selected: [] };
    }
  }

  function saveState() {
    runtime.state = normalizeState(runtime.state);
    try { localStorage.setItem(`${STORAGE_KEY}.state`, JSON.stringify(runtime.state)); } catch {}
  }

  function saveRecords(reason = 'updated') {
    runtime.records = runtime.records
      .map(normalizeRecord)
      .filter(Boolean)
      .filter((record) => record.saved || record.feedback || record.note || record.tags.length)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, MAX_RECORDS);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(runtime.records));
    } catch {
      announce('Mesaj notları bu cihazda kaydedilemedi.');
      return false;
    }
    window.dispatchEvent(new CustomEvent(STORAGE_EVENT, { detail: { reason } }));
    announce(reason === 'deleted' ? 'Mesaj kaydı kaldırıldı.' : 'Mesaj çalışma alanı güncellendi.');
    return true;
  }

  function announce(text) {
    if (!ui.toast || !text) return;
    ui.toast.textContent = text;
    ui.toast.classList.remove('hidden');
    window.clearTimeout(runtime.toastTimer);
    runtime.toastTimer = window.setTimeout(() => ui.toast.classList.add('hidden'), 2600);
  }

  function recordKey(conversationId, messageId) {
    return `${conversationId}:${messageId}`;
  }

  function findRecord(conversationId, messageId) {
    return runtime.records.find((record) => record.conversationId === conversationId && record.messageId === messageId) || null;
  }

  function recordForArticle(article) {
    if (!article) return null;
    const messageId = article.dataset.messageId;
    const conversationId = currentConversationId();
    if (!messageId || !conversationId) return null;
    return findRecord(conversationId, messageId);
  }

  function currentConversationId() {
    const active = document.querySelector('.conversation-row.active .conversation-open');
    return active?.dataset?.conversationId || '';
  }

  function findRecordOrCreate(article) {
    const conversationId = currentConversationId();
    const messageId = article?.dataset?.messageId || '';
    if (!conversationId || !messageId) return null;
    let record = findRecord(conversationId, messageId);
    if (!record) {
      record = {
        id: uid(),
        conversationId,
        messageId,
        saved: false,
        feedback: '',
        note: '',
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      runtime.records.push(record);
    }
    return record;
  }

  function pruneEmptyRecord(record) {
    if (!record) return;
    if (record.saved || record.feedback || record.note || record.tags.length) return;
    runtime.records = runtime.records.filter((item) => item.id !== record.id);
  }

  function safeMessageRole(article) {
    return article?.classList.contains('assistant') ? 'assistant' : 'user';
  }

  function messageText(article) {
    return cleanText(article?.querySelector('.content')?.textContent || '').slice(0, 12000);
  }

  function ensureActionBar(article) {
    if (!article || article.querySelector('.message-workspace-actions')) return article?.querySelector('.message-workspace-actions');
    const bar = document.createElement('div');
    bar.className = 'message-workspace-actions';
    bar.setAttribute('aria-label', 'Mesaj araçları');
    const save = actionButton('☆', 'Mesajı kaydet', 'message-save');
    const up = actionButton('↑', 'Yanıtı beğen', 'message-feedback-up');
    const down = actionButton('↓', 'Yanıtı beğenme', 'message-feedback-down');
    const note = actionButton('▤', 'Mesaja not ekle', 'message-note');
    const tag = actionButton('#', 'Mesaja etiket ekle', 'message-tag');
    const menu = actionButton('⋯', 'Mesaj çalışma alanı seçenekleri', 'message-more');
    save.addEventListener('click', () => toggleSaved(article));
    up.addEventListener('click', () => setFeedback(article, 'up'));
    down.addEventListener('click', () => setFeedback(article, 'down'));
    note.addEventListener('click', () => editNote(article));
    tag.addEventListener('click', () => editTags(article));
    menu.addEventListener('click', () => openMessageMenu(article));
    bar.append(save, up, down, note, tag, menu);
    article.append(bar);
    return bar;
  }

  function actionButton(symbol, label, className) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `message-workspace-action ${className}`;
    button.textContent = symbol;
    button.setAttribute('aria-label', label);
    button.title = label;
    return button;
  }

  function updateActionState(article, record = recordForArticle(article)) {
    const bar = ensureActionBar(article);
    if (!bar) return;
    const save = bar.querySelector('.message-save');
    const up = bar.querySelector('.message-feedback-up');
    const down = bar.querySelector('.message-feedback-down');
    const note = bar.querySelector('.message-note');
    const tag = bar.querySelector('.message-tag');
    save?.classList.toggle('active', record?.saved === true);
    save?.setAttribute('aria-pressed', String(record?.saved === true));
    save && (save.textContent = record?.saved ? '★' : '☆');
    up?.classList.toggle('active', record?.feedback === 'up');
    up?.setAttribute('aria-pressed', String(record?.feedback === 'up'));
    down?.classList.toggle('active', record?.feedback === 'down');
    down?.setAttribute('aria-pressed', String(record?.feedback === 'down'));
    note?.classList.toggle('active', Boolean(record?.note));
    tag?.classList.toggle('active', Boolean(record?.tags?.length));
    const summary = article.querySelector('.message-workspace-summary');
    summary?.remove();
    const marks = [];
    if (record?.note) marks.push(`Not: ${record.note.slice(0, 80)}`);
    if (record?.tags?.length) marks.push(`Etiket: ${record.tags.join(', ')}`);
    if (marks.length) {
      const info = document.createElement('div');
      info.className = 'message-workspace-summary';
      info.textContent = marks.join(' · ');
      info.title = marks.join(' · ');
      article.append(info);
    }
    article.classList.toggle('message-workspace-saved', Boolean(record?.saved));
  }

  function decorateArticle(article) {
    if (!(article instanceof HTMLElement) || !article.dataset.messageId) return;
    ensureActionBar(article);
    updateActionState(article);
  }

  function decorateAll() {
    ui.messages.querySelectorAll('.message[data-message-id]').forEach(decorateArticle);
  }

  function mutateRecord(article, reason, mutator) {
    const record = findRecordOrCreate(article);
    if (!record) return;
    mutator(record);
    record.updatedAt = new Date().toISOString();
    pruneEmptyRecord(record);
    saveRecords(reason);
    updateActionState(article, findRecord(currentConversationId(), article.dataset.messageId));
    renderResults();
  }

  function toggleSaved(article) {
    mutateRecord(article, record => { record.saved = !record.saved; }, 'saved');
  }

  function setFeedback(article, value) {
    mutateRecord(article, record => { record.feedback = record.feedback === value ? '' : value; }, 'feedback');
  }

  function editNote(article) {
    const record = findRecordOrCreate(article);
    if (!record) return;
    const next = globalThis.prompt('Bu mesaja kısa bir not ekle (en fazla 600 karakter):', record.note || '');
    if (next === null) return;
    record.note = cleanNote(next);
    record.updatedAt = new Date().toISOString();
    pruneEmptyRecord(record);
    saveRecords('note');
    updateActionState(article, findRecord(currentConversationId(), article.dataset.messageId));
    renderResults();
  }

  function editTags(article) {
    const record = findRecordOrCreate(article);
    if (!record) return;
    const next = globalThis.prompt('Etiketleri virgülle ayır (en fazla 8 etiket):', (record.tags || []).join(', '));
    if (next === null) return;
    record.tags = [...new Set(String(next).split(',').map(cleanTag).filter(Boolean))].slice(0, MAX_TAGS);
    record.updatedAt = new Date().toISOString();
    pruneEmptyRecord(record);
    saveRecords('tag');
    updateActionState(article, findRecord(currentConversationId(), article.dataset.messageId));
    renderResults();
  }

  function openMessageMenu(article) {
    const record = recordForArticle(article);
    const choice = globalThis.prompt('Mesaj işlemi: 1=Kaydı kaldır, 2=Notu temizle, 3=Etiketleri temizle, 4=Seçime ekle', '');
    if (!choice) return;
    if (choice === '1') {
      if (!record) return announce('Bu mesaj için kayıt yok.');
      record.saved = false; record.feedback = ''; record.note = ''; record.tags = [];
      pruneEmptyRecord(record); saveRecords('deleted'); updateActionState(article, null); renderResults();
      return;
    }
    if (choice === '2' && record) { record.note = ''; record.updatedAt = new Date().toISOString(); pruneEmptyRecord(record); saveRecords('note'); updateActionState(article, findRecord(currentConversationId(), article.dataset.messageId)); renderResults(); return; }
    if (choice === '3' && record) { record.tags = []; record.updatedAt = new Date().toISOString(); pruneEmptyRecord(record); saveRecords('tag'); updateActionState(article, findRecord(currentConversationId(), article.dataset.messageId)); renderResults(); return; }
    if (choice === '4') toggleSelection(record?.id);
  }

  function actionCount(record) {
    return Number(record?.saved) + Number(Boolean(record?.feedback)) + Number(Boolean(record?.note)) + Number(record?.tags?.length);
  }

  function matchesRecord(item) {
    const record = item.record;
    const filter = runtime.state.filter;
    if (filter === 'saved' && !record.saved) return false;
    if (filter === 'feedback' && !record.feedback) return false;
    if (filter === 'notes' && !record.note) return false;
    if (filter === 'tag' && !record.tags.length) return false;
    if (filter === 'user' && item.role !== 'user') return false;
    if (filter === 'assistant' && item.role !== 'assistant') return false;
    if (runtime.state.query) {
      const haystack = `${item.text} ${record.note} ${record.tags.join(' ')}`.toLocaleLowerCase('tr-TR');
      if (!haystack.includes(runtime.state.query)) return false;
    }
    return true;
  }

  function recordEntries() {
    const entries = [];
    const conversationId = currentConversationId();
    for (const record of runtime.records) {
      if (record.conversationId !== conversationId) continue;
      const article = ui.messages.querySelector(`[data-message-id="${CSS.escape(record.messageId)}"]`);
      entries.push({ record, article, role: safeMessageRole(article), text: messageText(article) });
    }
    return entries.filter((item) => item.text || item.record.note).filter(matchesRecord);
  }

  function sortEntries(entries) {
    return [...entries].sort((a, b) => {
      if (runtime.state.sort === 'oldest') return a.record.updatedAt.localeCompare(b.record.updatedAt);
      if (runtime.state.sort === 'feedback') return actionCount(b.record) - actionCount(a.record) || b.record.updatedAt.localeCompare(a.record.updatedAt);
      if (runtime.state.sort === 'notes') return Number(Boolean(b.record.note)) - Number(Boolean(a.record.note)) || b.record.updatedAt.localeCompare(a.record.updatedAt);
      return b.record.updatedAt.localeCompare(a.record.updatedAt);
    });
  }

  function toggleSelection(id) {
    if (!id) return;
    const selected = new Set(runtime.state.selected);
    if (selected.has(id)) selected.delete(id); else if (selected.size < MAX_EXPORT) selected.add(id);
    runtime.state.selected = [...selected];
    saveState();
    renderResults();
  }

  function clearSelection() {
    runtime.state.selected = [];
    saveState();
    renderResults();
  }

  function buildPanel() {
    const existing = document.querySelector('#messageWorkspacePanel');
    if (existing) existing.remove();
    const panel = document.createElement('section');
    panel.id = 'messageWorkspacePanel';
    panel.className = 'message-workspace-panel utility-card';
    panel.setAttribute('aria-labelledby', 'messageWorkspaceTitle');
    const head = document.createElement('div');
    head.className = 'message-workspace-panel-head';
    const heading = document.createElement('div');
    heading.className = 'utility-head';
    const icon = document.createElement('span'); icon.className = 'mini-icon'; icon.textContent = '★';
    const title = document.createElement('strong'); title.id = 'messageWorkspaceTitle'; title.textContent = 'Mesaj çalışma alanı';
    heading.append(icon, title);
    const help = document.createElement('button');
    help.type = 'button'; help.className = 'mini-btn'; help.textContent = '?'; help.setAttribute('aria-label', 'Mesaj çalışma alanı yardımı');
    help.addEventListener('click', () => announce('Mesajları kaydedebilir, yanıtı değerlendirebilir, not ve etiket ekleyebilir; aşağıdaki aramayla kayıtlarını bulabilirsin.'));
    head.append(heading, help);

    const search = document.createElement('input');
    search.type = 'search'; search.className = 'message-workspace-search'; search.maxLength = MAX_QUERY;
    search.placeholder = 'Kayıtlı mesajlarda ara…'; search.setAttribute('aria-label', 'Kayıtlı mesajlarda ara');
    search.value = runtime.state.query;
    search.addEventListener('input', () => { runtime.state.query = cleanText(search.value).toLocaleLowerCase('tr-TR').slice(0, MAX_QUERY); saveState(); renderResults(); });

    const controls = document.createElement('div'); controls.className = 'message-workspace-controls';
    const filter = document.createElement('select'); filter.className = 'message-workspace-select'; filter.setAttribute('aria-label', 'Mesaj filtresi');
    [['all','Tümü'],['saved','Kaydedilen'],['feedback','Geri bildirimli'],['notes','Notlu'],['user','Senin mesajların'],['assistant','Hafize yanıtları'],['tag','Etiketli']].forEach(([value,label]) => filter.append(new Option(label,value,false,runtime.state.filter===value)));
    filter.addEventListener('change', () => { runtime.state.filter = filter.value; saveState(); renderResults(); });
    const sort = document.createElement('select'); sort.className = 'message-workspace-select'; sort.setAttribute('aria-label', 'Mesaj sıralaması');
    [['newest','Güncellenen'],['oldest','Eski'],['feedback','Etkileşimli'],['notes','Notlular']].forEach(([value,label]) => sort.append(new Option(label,value,false,runtime.state.sort===value)));
    sort.addEventListener('change', () => { runtime.state.sort = sort.value; saveState(); renderResults(); });
    controls.append(filter, sort);

    const batch = document.createElement('div'); batch.className = 'message-workspace-batch';
    const selectedCount = document.createElement('span'); selectedCount.className = 'message-workspace-count';
    const selectVisible = makePanelButton('Görünenleri seç'); selectVisible.addEventListener('click', selectVisibleRecords);
    const clear = makePanelButton('Seçimi temizle'); clear.addEventListener('click', clearSelection);
    const exportButton = makePanelButton('JSON dışa aktar'); exportButton.addEventListener('click', exportSelected);
    batch.append(selectedCount, selectVisible, clear, exportButton);

    const status = document.createElement('div'); status.className = 'message-workspace-status'; status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
    const list = document.createElement('div'); list.className = 'message-workspace-results';
    panel.append(head, search, controls, batch, status, list);
    ui.rail.prepend(panel);
    runtime.panel = panel; runtime.search = search; runtime.filter = filter; runtime.sort = sort; runtime.status = status; runtime.resultList = list; runtime.clearButton = clear; runtime.exportButton = exportButton; runtime.selectionButton = selectVisible; runtime.selectionClearButton = clear;
    return panel;
  }

  function makePanelButton(label) {
    const button = document.createElement('button'); button.type='button'; button.className='soft-btn'; button.textContent=label; return button;
  }

  function selectVisibleRecords() {
    const ids = recordEntries().map((item) => item.record.id).slice(0, MAX_EXPORT);
    runtime.state.selected = [...new Set(ids)]; saveState(); renderResults();
  }

  function resultArticle(entry) {
    const wrap = document.createElement('article'); wrap.className='message-workspace-result';
    const check = document.createElement('input'); check.type='checkbox'; check.checked=runtime.state.selected.includes(entry.record.id); check.setAttribute('aria-label','Mesajı dışa aktarma seçimine ekle'); check.addEventListener('change',()=>toggleSelection(entry.record.id));
    const body=document.createElement('div'); body.className='message-workspace-result-body';
    const meta=document.createElement('div'); meta.className='message-workspace-result-meta'; meta.textContent=`${entry.role==='assistant'?'Hafize':'Sen'} · ${formatDate(entry.record.updatedAt)}`;
    const text=document.createElement('p'); text.className='message-workspace-result-text'; text.textContent=entry.text || 'Notlu mesaj';
    body.append(meta,text);
    if (entry.record.note) { const note=document.createElement('div'); note.className='message-workspace-result-note'; note.textContent=entry.record.note; body.append(note); }
    if (entry.record.tags.length) { const tags=document.createElement('div'); tags.className='message-workspace-result-tags'; tags.textContent=entry.record.tags.map(tag=>`#${tag}`).join(' '); body.append(tags); }
    const actions=document.createElement('div'); actions.className='message-workspace-result-actions';
    const focus=makePanelButton('Mesaja git'); focus.addEventListener('click',()=>focusMessage(entry));
    const remove=makePanelButton('Kaydı kaldır'); remove.addEventListener('click',()=>removeRecord(entry.record.id)); actions.append(focus,remove);
    wrap.append(check,body,actions); return wrap;
  }

  function formatDate(value) {
    try { return new Intl.DateTimeFormat('tr-TR',{dateStyle:'short',timeStyle:'short'}).format(new Date(value)); } catch { return ''; }
  }

  function renderResults() {
    if (!runtime.resultList) return;
    const entries = sortEntries(recordEntries());
    runtime.resultList.replaceChildren();
    const total = recordEntries().length;
    if (!entries.length) {
      const empty=document.createElement('p'); empty.className='message-workspace-empty'; empty.textContent='Bu görünümde kayıtlı mesaj yok.'; runtime.resultList.append(empty);
    } else entries.forEach(entry=>runtime.resultList.append(resultArticle(entry)));
    const selected = runtime.state.selected.length;
    runtime.status.textContent = `${total} kayıt · ${selected} seçili`;
    runtime.exportButton.disabled = selected === 0;
    runtime.selectionClearButton.disabled = selected === 0;
  }

  function focusMessage(entry) {
    const article = entry.article || ui.messages.querySelector(`[data-message-id="${CSS.escape(entry.record.messageId)}"]`);
    if (!article) return announce('Mesaj artık görünür değil; kayıt yerel geçmişte kaldı.');
    article.scrollIntoView({ behavior:'smooth', block:'center' });
    article.classList.add('message-workspace-focus');
    window.setTimeout(()=>article.classList.remove('message-workspace-focus'),1400);
  }

  function removeRecord(id) {
    runtime.records = runtime.records.filter(record=>record.id!==id); runtime.state.selected=runtime.state.selected.filter(item=>item!==id); saveState(); saveRecords('deleted'); decorateAll(); renderResults();
  }

  function exportSelected() {
    const selected = new Set(runtime.state.selected);
    const entries = recordEntries().filter(entry=>selected.has(entry.record.id)).slice(0,MAX_EXPORT);
    if (!entries.length) return announce('Önce en az bir mesaj seç.');
    const payload = { schema:'hafize-message-workspace/v1', exportedAt:new Date().toISOString(), records:entries.map(entry=>({ record:entry.record, role:entry.role, content:entry.text.slice(0,12000) })) };
    const blob = new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob); const link=document.createElement('a'); link.href=url; link.download=`hafize-messages-${new Date().toISOString().slice(0,10)}.json`; link.click(); URL.revokeObjectURL(url); announce(`${entries.length} mesaj dışa aktarıldı.`);
  }

  function handleShortcut(event) {
    const mod = event.ctrlKey || event.metaKey;
    if (!mod || !event.shiftKey) return;
    const key=event.key.toLowerCase();
    if (key==='b') { event.preventDefault(); runtime.search?.focus(); runtime.search?.select(); }
    if (key==='k') { event.preventDefault(); selectVisibleRecords(); announce('Görünen mesaj kayıtları seçildi.'); }
    if (key==='x') { event.preventDefault(); clearSelection(); }
  }

  function onStorage(event) {
    if (event.key === STORAGE_KEY) { runtime.records=loadRecords(); decorateAll(); renderResults(); }
    if (event.key === `${STORAGE_KEY}.state`) { runtime.state=loadState(); syncControls(); renderResults(); }
  }

  function syncControls() {
    if (!runtime.search) return;
    runtime.search.value=runtime.state.query;
    runtime.filter.value=runtime.state.filter;
    runtime.sort.value=runtime.state.sort;
  }

  function sweepMissingRecords() {
    const live = new Set([...ui.messages.querySelectorAll('.message[data-message-id]')].map(article => article.dataset.messageId));
    const conversationId=currentConversationId();
    if (!conversationId) return;
    const before=runtime.records.length;
    runtime.records=runtime.records.filter(record=>record.conversationId!==conversationId || live.has(record.messageId));
    if (runtime.records.length!==before) saveRecords('cleanup');
  }

  function setupObserver() {
    runtime.observer=new MutationObserver(()=>{
      window.clearTimeout(runtime.refreshTimer);
      runtime.refreshTimer=window.setTimeout(()=>{ decorateAll(); renderResults(); },0);
    });
    runtime.observer.observe(ui.messages,{childList:true,subtree:true});
  }

  function init() {
    buildPanel();
    decorateAll();
    renderResults();
    setupObserver();
    document.addEventListener('keydown', handleShortcut);
    window.addEventListener('storage', onStorage);
    window.addEventListener(STORAGE_EVENT, ()=>{ runtime.records=loadRecords(); decorateAll(); renderResults(); });
    window.addEventListener('hafize:conversation-workspace-changed', () => { runtime.records=loadRecords(); decorateAll(); renderResults(); });
    window.setInterval(sweepMissingRecords, 12000);
  }

  init();
})();
