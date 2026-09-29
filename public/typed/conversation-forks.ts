import {
  FORK_LIMITS,
  buildForkSnapshot,
  cleanForkText,
  conversationLineage,
  countDirectBranches,
  createFork,
  createForkId,
  directChildren,
  getConversationDepth,
  normalizeForkMessage
} from './conversation-fork-core.ts';

const cleanText = cleanForkText;
const uid = createForkId;
const copyMessage = normalizeForkMessage;
const conversationDepth = getConversationDepth;
const branchCount = countDirectBranches;
const makeFork = createFork;
const childrenOf = directChildren;
const lineageOf = conversationLineage;

(() => {
  'use strict';

  const STORAGE_KEY = 'hafize.conversations.v1';
  const PANEL_ID = 'hafizeConversationForks';
  const DIALOG_ID = 'hafizeConversationForkDialog';
  const MAX_CONVERSATIONS = 30;
  const MAX_MESSAGES = 100;
  const MAX_MESSAGE_LENGTH = 12000;
  const MAX_TITLE = 80;
  const MAX_BRANCHES_PER_PARENT = 8;
  const MAX_FORK_DEPTH = 4;
  const MAX_SNIPPET = 180;

  const ui = {
    messages: document.querySelector('#messages'),
    historyBlock: document.querySelector('.history-block'),
    conversationList: document.querySelector('#conversationList'),
    toast: document.querySelector('#toast')
  };
  if (!ui.messages || !ui.historyBlock || !ui.conversationList) return;

  let observer = null;
  let mounted = false;
  let activeDialog = null;
  let previousFocus = null;
  const listeners = [];

  function storage() {
    try { return globalThis.localStorage; } catch { return null; }
  }

  function readConversations() {
    const store = storage();
    if (!store) return [];
    try {
      const parsed = JSON.parse(store.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item) => item && typeof item === 'object' && typeof item.id === 'string').slice(0, MAX_CONVERSATIONS);
    } catch { return []; }
  }

  function writeConversations(next) {
    const store = storage();
    if (!store) return false;
    try {
      store.setItem(STORAGE_KEY, JSON.stringify(next.slice(0, MAX_CONVERSATIONS)));
      return true;
    } catch { return false; }
  }

  function showToast(message) {
    if (!ui.toast) return;
    ui.toast.textContent = cleanText(message, 180);
    ui.toast.classList.remove('hidden');
    globalThis.clearTimeout(showToast.timer);
    showToast.timer = globalThis.setTimeout(() => ui.toast.classList.add('hidden'), 3200);
  }

  function isBusy() {
    return ui.messages.getAttribute('aria-busy') === 'true';
  }

  function currentConversationId() {
    return cleanText(ui.messages.dataset.conversationId, 120);
  }

  function currentConversation(all = readConversations()) {
    const id = currentConversationId();
    return all.find((item) => item.id === id) || null;
  }

  function focusable(container) {
    return [...container.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')];
  }

  function closeDialog() {
    if (!activeDialog) return;
    const dialog = activeDialog;
    activeDialog = null;
    dialog.remove();
    previousFocus?.focus?.();
    previousFocus = null;
  }

  function openDialog(source, target, suggestedTitle, suggestedNote, onConfirm) {
    closeDialog();
    previousFocus = document.activeElement;

    const overlay = document.createElement('div');
    overlay.id = DIALOG_ID;
    overlay.className = 'conversation-fork-overlay';

    const panel = document.createElement('section');
    panel.className = 'conversation-fork-dialog';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', DIALOG_ID + 'Title');
    panel.setAttribute('aria-describedby', DIALOG_ID + 'Description');

    const title = document.createElement('h2');
    title.id = DIALOG_ID + 'Title';
    title.textContent = 'Konuşmayı buradan dallandır';

    const description = document.createElement('p');
    description.id = DIALOG_ID + 'Description';
    const count = Array.isArray(source.messages) ? source.messages.findIndex((m) => m?.id === target.id) + 1 : 0;
    const snippet = cleanText(target.content, MAX_SNIPPET).replace(/\s+/g, ' ');
    description.textContent = count + ' mesaj yeni sohbetin başlangıcı olacak. Seçilen mesaj: ' + snippet;

    const label = document.createElement('label');
    label.className = 'conversation-fork-label';
    label.textContent = 'Dal adı';
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.maxLength = MAX_TITLE;
    titleInput.value = cleanText(suggestedTitle, MAX_TITLE);
    titleInput.setAttribute('aria-label', 'Yeni konuşma dalının adı');
    titleInput.className = 'conversation-fork-title-input';

    const noteLabel = document.createElement('label');
    noteLabel.className = 'conversation-fork-label';
    noteLabel.textContent = 'Dal notu (isteğe bağlı)';
    const noteInput = document.createElement('textarea');
    noteInput.maxLength = FORK_LIMITS.maxForkNote;
    noteInput.rows = 3;
    noteInput.value = cleanText(suggestedNote, FORK_LIMITS.maxForkNote);
    noteInput.className = 'conversation-fork-note-input';
    noteInput.setAttribute('aria-label', 'Yeni konuşma dalının amacı veya notu');

    const note = document.createElement('p');
    note.className = 'conversation-fork-note';
    note.textContent = 'Yeni dal yerel sohbette ayrı bir kayıt olur. Şimdilik hiçbir ağ isteği gönderilmez.';

    const actions = document.createElement('div');
    actions.className = 'conversation-fork-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'soft-btn';
    cancel.textContent = 'Vazgeç';
    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'soft-btn conversation-fork-primary';
    confirm.textContent = 'Yeni dal oluştur';
    actions.append(cancel, confirm);

    panel.append(title, description, label, titleInput, noteLabel, noteInput, note, actions);
    overlay.append(panel);
    document.body.append(overlay);
    activeDialog = overlay;

    const finish = (confirmed) => {
      if (confirmed) onConfirm(cleanText(titleInput.value, MAX_TITLE), cleanText(noteInput.value, FORK_LIMITS.maxForkNote));
      else closeDialog();
    };
    cancel.addEventListener('click', () => finish(false));
    confirm.addEventListener('click', () => finish(true));
    overlay.addEventListener('click', (event) => { if (event.target === overlay) closeDialog(); });

    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { event.preventDefault(); closeDialog(); return; }
      if (event.key === 'Enter' && event.target !== cancel) { event.preventDefault(); finish(true); return; }
      if (event.key !== 'Tab') return;
      const nodes = focusable(panel);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });

    titleInput.focus();
    titleInput.select();
  }

  function comparisonData(parent, child) {
    const parentMessages = Array.isArray(parent?.messages) ? parent.messages : [];
    const childMessages = Array.isArray(child?.messages) ? child.messages : [];
    const forkId = cleanText(child?.forkMessageId, 120);
    const parentIndex = parentMessages.findIndex((message) => message?.id === forkId);
    const childIndex = childMessages.findIndex((message) => message?.id === forkId);
    const commonCount = parentIndex >= 0 ? parentIndex + 1 : Math.min(childMessages.length, parentMessages.length);
    const divergent = childIndex >= 0 ? childMessages.slice(childIndex + 1) : childMessages.slice(commonCount);
    return {
      parentTitle: cleanText(parent?.title, MAX_TITLE) || 'Üst sohbet',
      childTitle: cleanText(child?.title, MAX_TITLE) || 'Dal',
      commonCount,
      parentCount: parentMessages.length,
      childCount: childMessages.length,
      divergent: divergent.filter((message) => message?.role && typeof message.content === 'string').slice(0, 5)
    };
  }

  function openComparison(parent, child, trigger) {
    closeDialog();
    previousFocus = trigger || document.activeElement;
    const overlay = document.createElement('div');
    overlay.id = DIALOG_ID;
    overlay.className = 'conversation-fork-overlay';

    const panel = document.createElement('section');
    panel.className = 'conversation-fork-dialog conversation-fork-comparison';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', DIALOG_ID + 'CompareTitle');

    const heading = document.createElement('h2');
    heading.id = DIALOG_ID + 'CompareTitle';
    heading.textContent = 'Dal karşılaştırması';

    const summary = comparisonData(parent, child);
    const copy = document.createElement('p');
    copy.textContent = 'Ortak başlangıç ' + summary.commonCount + ' mesaj. Üst sohbet ' + summary.parentCount + ', dal ' + summary.childCount + ' mesaj içeriyor.';

    const names = document.createElement('div');
    names.className = 'conversation-fork-compare-names';
    const left = document.createElement('div');
    left.className = 'conversation-fork-compare-side';
    const leftTitle = document.createElement('strong');
    leftTitle.textContent = summary.parentTitle;
    left.append(leftTitle);
    const right = document.createElement('div');
    right.className = 'conversation-fork-compare-side';
    const rightTitle = document.createElement('strong');
    rightTitle.textContent = summary.childTitle;
    right.append(rightTitle);
    names.append(left, right);

    const list = document.createElement('div');
    list.className = 'conversation-fork-compare-list';
    list.setAttribute('role', 'list');
    if (!summary.divergent.length) {
      const empty = document.createElement('p');
      empty.className = 'conversation-fork-empty';
      empty.textContent = 'Bu dalda henüz parent’tan sonra yeni mesaj yok.';
      list.append(empty);
    } else {
      for (const message of summary.divergent) {
        const row = document.createElement('div');
        row.className = 'conversation-fork-compare-row';
        row.setAttribute('role', 'listitem');
        const role = document.createElement('span');
        role.className = 'conversation-fork-compare-role';
        role.textContent = message.role === 'assistant' ? 'Hafize' : 'Sen';
        const content = document.createElement('span');
        content.className = 'conversation-fork-compare-content';
        content.textContent = cleanText(message.content, 240);
        row.append(role, content);
        list.append(row);
      }
    }

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'soft-btn conversation-fork-primary';
    close.textContent = 'Kapat';
    close.addEventListener('click', closeDialog);

    panel.append(heading, copy, names, list, close);
    overlay.append(panel);
    document.body.append(overlay);
    activeDialog = overlay;

    overlay.addEventListener('click', (event) => { if (event.target === overlay) closeDialog(); });
    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { event.preventDefault(); closeDialog(); return; }
      if (event.key !== 'Tab') return;
      const nodes = focusable(panel);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    close.focus();
  }

  function createFork(messageId) {
    if (isBusy()) return showToast('Yanıt üretimi sürerken yeni dal oluşturulamaz.');

    const all = readConversations();
    const source = currentConversation(all);
    if (!source) return showToast('Aktif sohbet bulunamadı.');
    const target = Array.isArray(source.messages) ? source.messages.find((message) => message?.id === messageId) : null;
    if (!target) return showToast('Dallandırılacak mesaj bulunamadı.');

    const errors = {
      MESSAGE_NOT_FOUND: 'Mesaj bulunamadı.',
      DEPTH_LIMIT: 'Dal derinliği sınırına ulaşıldı.',
      BRANCH_LIMIT: 'Bu sohbet için en fazla 8 dal oluşturulabilir.',
      CONVERSATION_LIMIT: 'Yerel sohbet sınırı dolu. Önce bir sohbet sil.',
      EMPTY_FORK: 'Dala aktarılabilecek mesaj yok.'
    };
    const preview = makeFork(source, messageId, all);
    if (preview.error) return showToast(errors[preview.error] || 'Yeni dal oluşturulamadı.');

    const suggestedTitle = ('↳ ' + (cleanText(source.title, MAX_TITLE) || 'Sohbet') + ' · Dal ' + (branchCount(source.id, all) + 1)).slice(0, MAX_TITLE);
    openDialog(source, target, suggestedTitle, '', (titleOverride, noteOverride) => {
      const latest = readConversations();
      const freshSource = latest.find((item) => item.id === source.id);
      if (!freshSource) return showToast('Kaynak sohbet değişti; işlem iptal edildi.');
      const created = makeFork(freshSource, messageId, latest, { title: titleOverride, note: noteOverride });
      if (created.error) return showToast(errors[created.error] || 'Yeni dal oluşturulamadı.');
      const next = [created.conversation, ...latest].slice(0, MAX_CONVERSATIONS);
      if (!writeConversations(next)) return showToast('Yeni dal cihazda kalıcı olarak kaydedilemedi.');
      closeDialog();
      window.dispatchEvent(new CustomEvent('hafize:conversation-forks-changed', { detail: { conversationId: freshSource.id, forkId: created.conversation.id } }));
      window.dispatchEvent(new CustomEvent('hafize:open-conversation', { detail: { conversationId: created.conversation.id } }));
      showToast('Yeni konuşma dalı oluşturuldu.');
    });
  }

  function decorateMessages() {
    ui.messages.querySelectorAll('.message').forEach((article) => {
      if (article.querySelector('[data-conversation-fork]')) return;
      const messageId = cleanText(article.dataset.messageId, 120);
      if (!messageId) return;

      const actions = document.createElement('div');
      actions.className = 'message-fork-actions';
      const fork = document.createElement('button');
      fork.type = 'button';
      fork.className = 'message-action conversation-fork-button';
      fork.dataset.conversationFork = messageId;
      fork.textContent = 'Buradan dallandır';
      fork.setAttribute('aria-label', 'Bu mesajdan yeni konuşma dalı oluştur');
      fork.addEventListener('click', () => createFork(messageId));
      actions.append(fork);

      const target = article.querySelector('.assistant-message-actions') || article;
      target.append(actions);
    });
  }

  function descendantCount(conversationId, all, visited = new Set()) {
    if (visited.has(conversationId)) return 0;
    visited.add(conversationId);
    const children = directChildren(conversationId, all);
    return children.reduce((sum, child) => sum + 1 + descendantCount(child.id, all, visited), 0);
  }

  function renderGlobalBranchHub() {
    const all = readConversations();
    let panel = document.getElementById('hafizeConversationForkHub');
    const branches = all.filter((item) => item?.forkOf).sort((a, b) =>
      String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
    ).slice(0, 20);

    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'hafizeConversationForkHub';
      panel.className = 'conversation-fork-hub utility-card';
      panel.setAttribute('aria-labelledby', 'hafizeConversationForkHubTitle');

      const header = document.createElement('div');
      header.className = 'utility-head';
      const heading = document.createElement('span');
      heading.id = 'hafizeConversationForkHubTitle';
      heading.textContent = 'Tüm dallar';
      const count = document.createElement('span');
      count.className = 'conversation-fork-hub-count';
      header.append(heading, count);

      const search = document.createElement('input');
      search.type = 'search';
      search.maxLength = 80;
      search.className = 'conversation-fork-hub-search';
      search.placeholder = 'Dallarda ara…';
      search.setAttribute('aria-label', 'Tüm konuşma dallarında ara');

      const list = document.createElement('div');
      list.className = 'conversation-fork-hub-list';
      list.setAttribute('role', 'list');
      panel.append(header, search, list);
      ui.historyBlock.before(panel);

      search.addEventListener('input', () => renderGlobalBranchHub());
    }

    const search = panel.querySelector('.conversation-fork-hub-search');
    const list = panel.querySelector('.conversation-fork-hub-list');
    const query = cleanText(search?.value || '', 80).toLocaleLowerCase('tr-TR');
    const visible = branches.filter((item) => {
      const parent = all.find((candidate) => candidate.id === item.forkOf);
      return !query || [
        item.title,
        parent?.title || '',
        item.forkMessageId || ''
      ].join(' ').toLocaleLowerCase('tr-TR').includes(query);
    });

    const count = panel.querySelector('.conversation-fork-hub-count');
    count.textContent = String(branches.length);
    list.replaceChildren();

    if (!visible.length) {
      const empty = document.createElement('div');
      empty.className = 'conversation-fork-empty';
      empty.textContent = query ? 'Aramaya uyan dal yok.' : 'Henüz konuşma dalı yok.';
      list.append(empty);
      return;
    }

    visible.slice(0, 12).forEach((item) => {
      const row = document.createElement('div');
      row.className = 'conversation-fork-hub-row';
      row.setAttribute('role', 'listitem');

      const info = document.createElement('div');
      info.className = 'conversation-fork-hub-info';
      const name = document.createElement('strong');
      name.textContent = cleanText(item.title, MAX_TITLE) || 'Yeni dal';
      const parent = all.find((candidate) => candidate.id === item.forkOf);
      const meta = document.createElement('span');
      meta.textContent = (parent ? cleanText(parent.title, 42) : 'Üst sohbet yok')
        + ' · Seviye ' + (Number(item.forkDepth) || 1)
        + ' · ' + (Array.isArray(item.messages) ? item.messages.length : 0) + ' mesaj';
      if (typeof item.forkNote === 'string' && item.forkNote.trim()) {
        meta.textContent += ' · ' + cleanText(item.forkNote, 90);
      }
      info.append(name, meta);

      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'mini-btn';
      open.textContent = 'Aç';
      open.setAttribute('aria-label', (cleanText(item.title, MAX_TITLE) || 'Yeni dal') + ' dalını aç');
      open.addEventListener('click', () => window.dispatchEvent(new CustomEvent('hafize:open-conversation', {
        detail: { conversationId: item.id }
      })));

      row.append(info, open);
      list.append(row);
    });
  }

  function focusForkPoint(conversation) {
    const id = cleanText(conversation?.forkMessageId, 120);
    if (!id) return showToast('Bu sohbetin kayıtlı fork noktası yok.');
    const node = ui.messages.querySelector('[data-message-id="' + CSS.escape(id) + '"]');
    if (!node) return showToast('Fork noktası bu konuşmada bulunamadı.');
    node.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    node.querySelector?.('button')?.focus?.();
  }

  function renderBranchPanel() {
    const all = readConversations();
    const active = currentConversation(all);
    let panel = document.getElementById(PANEL_ID);
    if (!active) { panel?.remove(); return; }

    if (!panel) {
      panel = document.createElement('section');
      panel.id = PANEL_ID;
      panel.className = 'conversation-fork-panel utility-card';
      panel.setAttribute('aria-labelledby', PANEL_ID + 'Title');

      const header = document.createElement('div');
      header.className = 'utility-head conversation-fork-head';
      const heading = document.createElement('span');
      heading.id = PANEL_ID + 'Title';
      heading.textContent = 'Konuşma dalları';
      const count = document.createElement('span');
      count.className = 'conversation-fork-count';
      header.append(heading, count);

      const body = document.createElement('div');
      body.className = 'conversation-fork-body';
      panel.append(header, body);
      ui.historyBlock.after(panel);
    }

    const count = panel.querySelector('.conversation-fork-count');
    const body = panel.querySelector('.conversation-fork-body');
    const children = childrenOf(active.id, all);
    count.textContent = String(children.length);
    body.replaceChildren();

    const context = document.createElement('p');
    context.className = 'conversation-fork-context';
    if (active.forkOf) {
      const parent = all.find((item) => item.id === active.forkOf);
      context.textContent = parent ? 'Bu dal: ' + cleanText(parent.title, MAX_TITLE) + ' · Seviye ' + (Number(active.forkDepth) || 1) : 'Bu dalın üst sohbeti bulunamıyor.';
    } else {
      context.textContent = 'Bu sohbetin yerel dalları';
    }
    const lineage = lineageOf(active, all);
    const breadcrumbRow = document.createElement('div');
    breadcrumbRow.className = 'conversation-fork-lineage';
    breadcrumbRow.setAttribute('aria-label', 'Konuşma dalı soyu');
    lineage.forEach((item, index) => {
      const crumb = document.createElement('button');
      crumb.type = 'button';
      crumb.className = 'mini-btn conversation-fork-crumb';
      crumb.textContent = cleanText(item.title, MAX_TITLE) || 'Sohbet';
      crumb.setAttribute('aria-label', (cleanText(item.title, MAX_TITLE) || 'Sohbet') + ' sohbetine geç');
      crumb.disabled = item.id === active.id;
      crumb.addEventListener('click', () => window.dispatchEvent(new CustomEvent('hafize:open-conversation', { detail: { conversationId: item.id } })));
      breadcrumbRow.append(crumb);
      if (index < lineage.length - 1) breadcrumbRow.append(document.createTextNode('›'));
    });
    const tools = document.createElement('div');
    tools.className = 'conversation-fork-panel-actions';
    if (active.forkOf) {
      const pointButton = document.createElement('button');
      pointButton.type = 'button';
      pointButton.className = 'mini-btn';
      pointButton.textContent = 'Fork noktası';
      pointButton.setAttribute('aria-label', 'Bu dalın fork noktasına git');
      pointButton.addEventListener('click', () => focusForkPoint(active));
      tools.append(pointButton);

      const parentButton = document.createElement('button');
      parentButton.type = 'button';
      parentButton.className = 'mini-btn';
      parentButton.textContent = 'Üst sohbet';
      parentButton.setAttribute('aria-label', 'Bu dalın üst sohbetini aç');
      parentButton.addEventListener('click', () => window.dispatchEvent(new CustomEvent('hafize:open-conversation', {
        detail: { conversationId: active.forkOf }
      })));
      tools.append(parentButton);
    }
    const exportButton = document.createElement('button');
    exportButton.type = 'button';
    exportButton.className = 'mini-btn';
    exportButton.textContent = 'Dal yedeği';
    exportButton.setAttribute('aria-label', 'Bu konuşma dalını JSON olarak dışa aktar');
    exportButton.addEventListener('click', () => downloadConversation(active));
    tools.append(exportButton);
    const descendants = descendantCount(active.id, all);
    const stats = document.createElement('p');
    stats.className = 'conversation-fork-context';
    stats.textContent = descendants + ' alt dal' + (descendants === 1 ? '' : 'ı') + ' · ' + lineage.length + ' seviye bağlam';
    body.append(context, breadcrumbRow, stats, tools);

    if (!children.length) {
      const empty = document.createElement('div');
      empty.className = 'conversation-fork-empty';
      empty.textContent = 'Henüz bu sohbetten dal oluşturulmadı.';
      body.append(empty);
      return;
    }

    const list = document.createElement('div');
    list.className = 'conversation-fork-list';
    list.setAttribute('role', 'list');

    children.forEach((child) => {
      const row = document.createElement('div');
      row.className = 'conversation-fork-row';
      row.setAttribute('role', 'listitem');

      const info = document.createElement('div');
      info.className = 'conversation-fork-info';
      const name = document.createElement('strong');
      name.textContent = cleanText(child.title, MAX_TITLE) || 'Yeni dal';
      const meta = document.createElement('span');
      meta.textContent = (Array.isArray(child.messages) ? child.messages.length : 0) + ' mesaj · Seviye ' + (Number(child.forkDepth) || 1);
      info.append(name, meta);
      if (typeof child.forkNote === 'string' && child.forkNote.trim()) {
        const reason = document.createElement('span');
        reason.className = 'conversation-fork-note-preview';
        reason.textContent = cleanText(child.forkNote, 120);
        info.append(reason);
      }

      const compare = document.createElement('button');
      compare.type = 'button';
      compare.className = 'mini-btn';
      compare.textContent = 'Karşılaştır';
      compare.setAttribute('aria-label', (cleanText(child.title, MAX_TITLE) || 'Yeni dal') + ' dalını üst sohbetle karşılaştır');
      compare.addEventListener('click', () => {
        const parent = all.find((item) => item.id === child.forkOf);
        if (parent) openComparison(parent, child, compare);
      });

      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'mini-btn';
      open.textContent = 'Aç';
      open.setAttribute('aria-label', (cleanText(child.title, MAX_TITLE) || 'Yeni dal') + ' dalını aç');
      open.addEventListener('click', () => window.dispatchEvent(new CustomEvent('hafize:open-conversation', { detail: { conversationId: child.id } })));

      const rowActions = document.createElement('div');
      rowActions.className = 'conversation-fork-row-actions';
      rowActions.append(compare, open);
      row.append(info, rowActions);
      list.append(row);
    });
    body.append(list);
  }

  function onRefresh() {
    decorateMessages();
    renderBranchPanel();
    renderGlobalBranchHub();
  }

  function onStorage(event) {
    if (event.key === STORAGE_KEY) onRefresh();
  }

  function onKeydown(event) {
    if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.key.toLowerCase() !== 'f') return;
    const target = event.target;
    if (target?.matches?.('input, textarea, select, button, [contenteditable="true"]')) return;
    const active = currentConversation();
    const messages = Array.isArray(active?.messages) ? active.messages : [];
    const last = messages.at(-1);
    if (!last?.id) return;
    event.preventDefault();
    createFork(last.id);
  }

  function boot() {
    if (mounted) return;
    mounted = true;
    observer = new MutationObserver(onRefresh);
    observer.observe(ui.messages, { childList: true, subtree: true });
    const openHandler = () => onRefresh();
    const forkHandler = () => onRefresh();
    const storageHandler = (event) => onStorage(event);
    window.addEventListener('hafize:open-conversation', openHandler);
    window.addEventListener('hafize:conversation-forks-changed', forkHandler);
    window.addEventListener('storage', storageHandler);
    document.addEventListener('keydown', onKeydown);
    listeners.push(() => observer?.disconnect());
    listeners.push(() => window.removeEventListener('hafize:open-conversation', openHandler));
    listeners.push(() => window.removeEventListener('hafize:conversation-forks-changed', forkHandler));
    listeners.push(() => window.removeEventListener('storage', storageHandler));
    listeners.push(() => document.removeEventListener('keydown', onKeydown));
    onRefresh();
  }

  boot();

  window.HafizeConversationForks = Object.freeze({
    STORAGE_KEY,
    MAX_BRANCHES_PER_PARENT,
    MAX_FORK_DEPTH: FORK_LIMITS.maxDepth,
    makeFork: (conversation, messageId, all = [conversation]) => makeFork(conversation, messageId, all),
    childrenOf,
    lineageOf,
    downloadConversation,
    createFork
  });

  window.addEventListener('beforeunload', () => {
    for (const off of listeners.splice(0)) off();
    observer?.disconnect();
    closeDialog();
  });
})()  function showToast(message) {
    if (!ui.toast) return;
    ui.toast.textContent = cleanText(message, 180);
    ui.toast.classList.remove('hidden');
    globalThis.clearTimeout(showToast.timer);
    showToast.timer = globalThis.setTimeout(() => ui.toast.classList.add('hidden'), 3200);
  }

  function isBusy() {
    return ui.messages.getAttribute('aria-busy') === 'true';
  }

  function currentConversationId() {
    return cleanText(ui.messages.dataset.conversationId, 120);
  }

  function currentConversation(all = readConversations()) {
    const id = currentConversationId();
    return all.find((item) => item.id === id) || null;
  }

  function focusable(container) {
    return [...container.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')];
  }

  function closeDialog() {
    if (!activeDialog) return;
    const dialog = activeDialog;
    activeDialog = null;
    dialog.remove();
    previousFocus?.focus?.();
    previousFocus = null;
  }

  function openDialog(source, target, onConfirm) {
    closeDialog();
    previousFocus = document.activeElement;

    const overlay = document.createElement('div');
    overlay.id = DIALOG_ID;
    overlay.className = 'conversation-fork-overlay';

    const panel = document.createElement('section');
    panel.className = 'conversation-fork-dialog';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', DIALOG_ID + 'Title');
    panel.setAttribute('aria-describedby', DIALOG_ID + 'Description');

    const title = document.createElement('h2');
    title.id = DIALOG_ID + 'Title';
    title.textContent = 'Konuşmayı buradan dallandır';

    const description = document.createElement('p');
    description.id = DIALOG_ID + 'Description';
    const count = Array.isArray(source.messages) ? source.messages.findIndex((m) => m?.id === target.id) + 1 : 0;
    const snippet = cleanText(target.content, MAX_SNIPPET).replace(/\s+/g, ' ');
    description.textContent = count + ' mesaj yeni sohbetin başlangıcı olacak. Seçilen mesaj: ' + snippet;

    const note = document.createElement('p');
    note.className = 'conversation-fork-note';
    note.textContent = 'Yeni dal yerel sohbette ayrı bir kayıt olur. Şimdilik hiçbir ağ isteği gönderilmez.';

    const actions = document.createElement('div');
    actions.className = 'conversation-fork-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'soft-btn';
    cancel.textContent = 'Vazgeç';
    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'soft-btn conversation-fork-primary';
    confirm.textContent = 'Yeni dal oluştur';
    actions.append(cancel, confirm);

    panel.append(title, description, note, actions);
    overlay.append(panel);
    document.body.append(overlay);
    activeDialog = overlay;

    const finish = (confirmed) => {
      if (confirmed) onConfirm();
      else closeDialog();
    };
    cancel.addEventListener('click', () => finish(false));
    confirm.addEventListener('click', () => finish(true));
    overlay.addEventListener('click', (event) => { if (event.target === overlay) closeDialog(); });

    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { event.preventDefault(); closeDialog(); return; }
      if (event.key === 'Enter' && event.target !== cancel) { event.preventDefault(); finish(true); return; }
      if (event.key !== 'Tab') return;
      const nodes = focusable(panel);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });

    confirm.focus();
  }

  function createFork(messageId) {
    if (isBusy()) return showToast('Yanıt üretimi sürerken yeni dal oluşturulamaz.');

    const all = readConversations();
    const source = currentConversation(all);
    if (!source) return showToast('Aktif sohbet bulunamadı.');
    const target = Array.isArray(source.messages) ? source.messages.find((message) => message?.id === messageId) : null;
    if (!target) return showToast('Dallandırılacak mesaj bulunamadı.');

    const errors = {
      MESSAGE_NOT_FOUND: 'Mesaj bulunamadı.',
      DEPTH_LIMIT: 'Dal derinliği sınırına ulaşıldı.',
      BRANCH_LIMIT: 'Bu sohbet için en fazla 8 dal oluşturulabilir.',
      CONVERSATION_LIMIT: 'Yerel sohbet sınırı dolu. Önce bir sohbet sil.',
      EMPTY_FORK: 'Dala aktarılabilecek mesaj yok.'
    };
    const preview = makeFork(source, messageId, all);
    if (preview.error) return showToast(errors[preview.error] || 'Yeni dal oluşturulamadı.');

    openDialog(source, target, () => {
      const latest = readConversations();
      const freshSource = latest.find((item) => item.id === source.id);
      if (!freshSource) return showToast('Kaynak sohbet değişti; işlem iptal edildi.');
      const created = makeFork(freshSource, messageId, latest);
      if (created.error) return showToast(errors[created.error] || 'Yeni dal oluşturulamadı.');
      const next = [created.conversation, ...latest].slice(0, MAX_CONVERSATIONS);
      if (!writeConversations(next)) return showToast('Yeni dal cihazda kalıcı olarak kaydedilemedi.');
      closeDialog();
      window.dispatchEvent(new CustomEvent('hafize:conversation-forks-changed', { detail: { conversationId: freshSource.id, forkId: created.conversation.id } }));
      window.dispatchEvent(new CustomEvent('hafize:open-conversation', { detail: { conversationId: created.conversation.id } }));
      showToast('Yeni konuşma dalı oluşturuldu.');
    });
  }

  function decorateMessages() {
    ui.messages.querySelectorAll('.message').forEach((article) => {
      if (article.querySelector('[data-conversation-fork]')) return;
      const messageId = cleanText(article.dataset.messageId, 120);
      if (!messageId) return;

      const actions = document.createElement('div');
      actions.className = 'message-fork-actions';
      const fork = document.createElement('button');
      fork.type = 'button';
      fork.className = 'message-action conversation-fork-button';
      fork.dataset.conversationFork = messageId;
      fork.textContent = 'Buradan dallandır';
      fork.setAttribute('aria-label', 'Bu mesajdan yeni konuşma dalı oluştur');
      fork.addEventListener('click', () => createFork(messageId));
      actions.append(fork);

      const target = article.querySelector('.assistant-message-actions') || article;
      target.append(actions);
    });
  }

  function childrenOf(conversationId, all) {
    return all.filter((item) => item?.forkOf === conversationId)
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
      .slice(0, MAX_BRANCHES_PER_PARENT);
  }

  function lineageOf(conversation, all) {
    const chain = [];
    const seen = new Set();
    let cursor = conversation;
    while (cursor && !seen.has(cursor.id) && chain.length <= MAX_FORK_DEPTH + 1) {
      chain.unshift(cursor);
      seen.add(cursor.id);
      cursor = cursor.forkOf ? all.find((item) => item.id === cursor.forkOf) || null : null;
    }
    return chain;
  }

  function downloadConversation(conversation) {
    const snapshot = {
      version: 1,
      type: 'hafize-conversation-fork',
      exportedAt: new Date().toISOString(),
      conversation
    };
    try {
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'hafize-' + (cleanText(conversation.title, 48) || 'sohbet') + '.json';
      link.click();
      globalThis.setTimeout?.(() => URL.revokeObjectURL(url), 0);
      showToast('Dal yedeği indirildi.');
    } catch {
      showToast('Dal yedeği oluşturulamadı.');
    }
  }

  function renderBranchPanel() {
    const all = readConversations();
    const active = currentConversation(all);
    let panel = document.getElementById(PANEL_ID);
    if (!active) { panel?.remove(); return; }

    if (!panel) {
      panel = document.createElement('section');
      panel.id = PANEL_ID;
      panel.className = 'conversation-fork-panel utility-card';
      panel.setAttribute('aria-labelledby', PANEL_ID + 'Title');

      const header = document.createElement('div');
      header.className = 'utility-head conversation-fork-head';
      const heading = document.createElement('span');
      heading.id = PANEL_ID + 'Title';
      heading.textContent = 'Konuşma dalları';
      const count = document.createElement('span');
      count.className = 'conversation-fork-count';
      header.append(heading, count);

      const body = document.createElement('div');
      body.className = 'conversation-fork-body';
      panel.append(header, body);
      ui.historyBlock.after(panel);
    }

    const count = panel.querySelector('.conversation-fork-count');
    const body = panel.querySelector('.conversation-fork-body');
    const children = childrenOf(active.id, all);
    count.textContent = String(children.length);
    body.replaceChildren();

    const context = document.createElement('p');
    context.className = 'conversation-fork-context';
    if (active.forkOf) {
      const parent = all.find((item) => item.id === active.forkOf);
      context.textContent = parent ? 'Bu dal: ' + cleanText(parent.title, MAX_TITLE) + ' · Seviye ' + (Number(active.forkDepth) || 1) : 'Bu dalın üst sohbeti bulunamıyor.';
    } else {
      context.textContent = 'Bu sohbetin yerel dalları';
    }
    const tools = document.createElement('div');
    tools.className = 'conversation-fork-panel-actions';
    if (active.forkOf) {
      const parentButton = document.createElement('button');
      parentButton.type = 'button';
      parentButton.className = 'mini-btn';
      parentButton.textContent = 'Üst sohbet';
      parentButton.setAttribute('aria-label', 'Bu dalın üst sohbetini aç');
      parentButton.addEventListener('click', () => window.dispatchEvent(new CustomEvent('hafize:open-conversation', {
        detail: { conversationId: active.forkOf }
      })));
      tools.append(parentButton);
    }
    const exportButton = document.createElement('button');
    exportButton.type = 'button';
    exportButton.className = 'mini-btn';
    exportButton.textContent = 'Dal yedeği';
    exportButton.setAttribute('aria-label', 'Bu konuşma dalını JSON olarak dışa aktar');
    exportButton.addEventListener('click', () => downloadConversation(active));
    tools.append(exportButton);
    body.append(context, tools);

    if (!children.length) {
      const empty = document.createElement('div');
      empty.className = 'conversation-fork-empty';
      empty.textContent = 'Henüz bu sohbetten dal oluşturulmadı.';
      body.append(empty);
      return;
    }

    const list = document.createElement('div');
    list.className = 'conversation-fork-list';
    list.setAttribute('role', 'list');

    children.forEach((child) => {
      const row = document.createElement('div');
      row.className = 'conversation-fork-row';
      row.setAttribute('role', 'listitem');

      const info = document.createElement('div');
      info.className = 'conversation-fork-info';
      const name = document.createElement('strong');
      name.textContent = cleanText(child.title, MAX_TITLE) || 'Yeni dal';
      const meta = document.createElement('span');
      meta.textContent = (Array.isArray(child.messages) ? child.messages.length : 0) + ' mesaj';
      info.append(name, meta);

      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'mini-btn';
      open.textContent = 'Aç';
      open.setAttribute('aria-label', (cleanText(child.title, MAX_TITLE) || 'Yeni dal') + ' dalını aç');
      open.addEventListener('click', () => window.dispatchEvent(new CustomEvent('hafize:open-conversation', { detail: { conversationId: child.id } })));

      row.append(info, open);
      list.append(row);
    });
    body.append(list);
  }

  function onRefresh() {
    decorateMessages();
    renderBranchPanel();
  }

  function onStorage(event) {
    if (event.key === STORAGE_KEY) onRefresh();
  }

  function onKeydown(event) {
    if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.key.toLowerCase() !== 'f') return;
    const target = event.target;
    if (target?.matches?.('input, textarea, select, button, [contenteditable="true"]')) return;
    const active = currentConversation();
    const messages = Array.isArray(active?.messages) ? active.messages : [];
    const last = messages.at(-1);
    if (!last?.id) return;
    event.preventDefault();
    createFork(last.id);
  }

  function boot() {
    if (mounted) return;
    mounted = true;
    observer = new MutationObserver(onRefresh);
    observer.observe(ui.messages, { childList: true, subtree: true });
    const openHandler = () => onRefresh();
    const forkHandler = () => onRefresh();
    const storageHandler = (event) => onStorage(event);
    window.addEventListener('hafize:open-conversation', openHandler);
    window.addEventListener('hafize:conversation-forks-changed', forkHandler);
    window.addEventListener('storage', storageHandler);
    document.addEventListener('keydown', onKeydown);
    listeners.push(() => observer?.disconnect());
    listeners.push(() => window.removeEventListener('hafize:open-conversation', openHandler));
    listeners.push(() => window.removeEventListener('hafize:conversation-forks-changed', forkHandler));
    listeners.push(() => window.removeEventListener('storage', storageHandler));
    listeners.push(() => document.removeEventListener('keydown', onKeydown));
    onRefresh();
  }

  boot();

  window.HafizeConversationForks = Object.freeze({
    STORAGE_KEY,
    MAX_BRANCHES_PER_PARENT,
    MAX_FORK_DEPTH,
    makeFork: (conversation, messageId, all = [conversation]) => makeFork(conversation, messageId, all),
    childrenOf,
    lineageOf,
    downloadConversation,
    createFork
  });

  window.addEventListener('beforeunload', () => {
    for (const off of listeners.splice(0)) off();
    observer?.disconnect();
    closeDialog();
  });
})();