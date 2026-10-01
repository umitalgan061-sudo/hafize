import {
  FORK_LIMITS,
  buildForkSnapshot,
  cleanForkText,
  conversationLineage,
  countDirectBranches,
  createFork as buildFork,
  directChildren
} from './conversation-fork-core.ts';
import type { ForkConversation, ForkMessage } from './conversation-fork-core.ts';

const cleanText = cleanForkText;
const makeFork = buildFork;
const childrenOf = directChildren;
const lineageOf = conversationLineage;
const branchCount = countDirectBranches;

interface ForkPublicApi {
  readonly STORAGE_KEY: string;
  readonly MAX_BRANCHES_PER_PARENT: number;
  readonly MAX_FORK_DEPTH: number;
  readonly makeFork: (conversation: ForkConversation, messageId: string, all?: readonly ForkConversation[]) => unknown;
  readonly childrenOf: typeof directChildren;
  readonly lineageOf: typeof conversationLineage;
  readonly downloadConversation: (conversation: ForkConversation) => void;
  readonly createFork: (messageId: string) => void;
}

(() => {
  'use strict';

  const STORAGE_KEY = 'hafize.conversations.v1';
  const PANEL_ID = 'hafizeConversationForks';
  const DIALOG_ID = 'hafizeConversationForkDialog';
  const MAX_CONVERSATIONS = 30;
  const MAX_TITLE = 80;
  const MAX_BRANCHES_PER_PARENT = 8;
  const MAX_SNIPPET = 180;

  const messagesNode = document.querySelector<HTMLElement>('#messages');
  const historyNode = document.querySelector<HTMLElement>('.history-block');
  const conversationListNode = document.querySelector<HTMLElement>('#conversationList');
  const toastNode = document.querySelector<HTMLElement>('#toast');
  if (!messagesNode || !historyNode || !conversationListNode) return;

  const messagesRoot: HTMLElement = messagesNode;
  const historyBlock: HTMLElement = historyNode;

  let observer: MutationObserver | null = null;
  let mounted = false;
  let activeDialog: HTMLElement | null = null;
  let previousFocus: HTMLElement | null = null;
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  const listeners: Array<() => void> = [];

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  function storage(): Storage | null {
    try { return globalThis.localStorage; } catch { return null; }
  }

  function readConversations(): ForkConversation[] {
    const store = storage();
    if (!store) return [];
    try {
      const parsed: unknown = JSON.parse(store.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((item): item is ForkConversation => isRecord(item) && typeof item.id === 'string')
        .slice(0, MAX_CONVERSATIONS);
    } catch { return []; }
  }

  function writeConversations(next: readonly ForkConversation[]): boolean {
    const store = storage();
    if (!store) return false;
    try {
      store.setItem(STORAGE_KEY, JSON.stringify(next.slice(0, MAX_CONVERSATIONS)));
      return true;
    } catch { return false; }
  }

  function showToast(message: string): void {
    if (!toastNode) return;
    toastNode.textContent = cleanText(message, 180);
    toastNode.classList.remove('hidden');
    globalThis.clearTimeout(toastTimer);
    toastTimer = globalThis.setTimeout(() => toastNode.classList.add('hidden'), 3200);
  }

  function isBusy(): boolean {
    return messagesRoot.getAttribute('aria-busy') === 'true';
  }

  function currentConversationId(): string {
    return cleanText(messagesRoot.dataset.conversationId, 120);
  }

  function currentConversation(all: readonly ForkConversation[] = readConversations()): ForkConversation | null {
    const id = currentConversationId();
    return all.find((item) => item.id === id) || null;
  }

  function focusable(container: HTMLElement): HTMLElement[] {
    return [...container.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')];
  }

  function closeDialog(): void {
    if (!activeDialog) return;
    const dialog = activeDialog;
    activeDialog = null;
    dialog.remove();
    previousFocus?.focus?.();
    previousFocus = null;
  }

  function trapTab(event: KeyboardEvent, panel: HTMLElement): void {
    const nodes = focusable(panel);
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  function activeElement(): HTMLElement | null {
    const node = document.activeElement;
    return node instanceof HTMLElement ? node : null;
  }

  function openDialog(
    source: ForkConversation,
    target: ForkMessage,
    suggestedTitle: string,
    suggestedNote: string,
    onConfirm: (title: string, note: string) => void
  ): void {
    closeDialog();
    previousFocus = activeElement();

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

    const finish = (confirmed: boolean): void => {
      if (confirmed) onConfirm(cleanText(titleInput.value, MAX_TITLE), cleanText(noteInput.value, FORK_LIMITS.maxForkNote));
      else closeDialog();
    };
    cancel.addEventListener('click', () => finish(false));
    confirm.addEventListener('click', () => finish(true));
    overlay.addEventListener('click', (event) => { if (event.target === overlay) closeDialog(); });

    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { event.preventDefault(); closeDialog(); return; }
      const node = event.target instanceof Element ? event.target : null;
      const tagName = node?.tagName;
      if (event.key === 'Enter' && tagName !== 'INPUT' && tagName !== 'TEXTAREA' && event.target !== cancel) { event.preventDefault(); finish(true); return; }
      if (event.key !== 'Tab') return;
      trapTab(event, panel);
    });

    titleInput.focus();
    titleInput.select();
  }

  interface ComparisonSummary {
    readonly parentTitle: string;
    readonly childTitle: string;
    readonly commonCount: number;
    readonly parentCount: number;
    readonly childCount: number;
    readonly divergent: readonly ForkMessage[];
  }

  function comparisonData(parent: ForkConversation | null, child: ForkConversation): ComparisonSummary {
    const parentMessages: readonly ForkMessage[] = Array.isArray(parent?.messages) ? parent.messages : [];
    const childMessages: readonly ForkMessage[] = Array.isArray(child?.messages) ? child.messages : [];
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

  function openComparison(parent: ForkConversation, child: ForkConversation, trigger: HTMLElement | null): void {
    closeDialog();
    previousFocus = trigger || activeElement();
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
      trapTab(event, panel);
    });
    close.focus();
  }

  const FORK_ERROR_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
    MESSAGE_NOT_FOUND: 'Mesaj bulunamadı.',
    DEPTH_LIMIT: 'Dal derinliği sınırına ulaşıldı.',
    BRANCH_LIMIT: 'Bu sohbet için en fazla 8 dal oluşturulabilir.',
    CONVERSATION_LIMIT: 'Yerel sohbet sınırı dolu. Önce bir sohbet sil.',
    EMPTY_FORK: 'Dala aktarılabilecek mesaj yok.'
  });

  function forkErrorMessage(code: string | undefined): string {
    return (code ? FORK_ERROR_MESSAGES[code] : undefined) || 'Yeni dal oluşturulamadı.';
  }

  function createFork(messageId: string): void {
    if (isBusy()) {
      showToast('Yanıt üretimi sürerken yeni dal oluşturulamaz.');
      return;
    }

    const all = readConversations();
    const source = currentConversation(all);
    if (!source) {
      showToast('Aktif sohbet bulunamadı.');
      return;
    }
    const target = Array.isArray(source.messages) ? source.messages.find((message) => message?.id === messageId) : undefined;
    if (!target) {
      showToast('Dallandırılacak mesaj bulunamadı.');
      return;
    }

    const preview = makeFork(source, messageId, all);
    if (preview.error) {
      showToast(forkErrorMessage(preview.error));
      return;
    }

    const suggestedTitle = ('↳ ' + (cleanText(source.title, MAX_TITLE) || 'Sohbet') + ' · Dal ' + (branchCount(source.id, all) + 1)).slice(0, MAX_TITLE);
    openDialog(source, target, suggestedTitle, '', (titleOverride, noteOverride) => {
      const latest = readConversations();
      const freshSource = latest.find((item) => item.id === source.id);
      if (!freshSource) {
        showToast('Kaynak sohbet değişti; işlem iptal edildi.');
        return;
      }
      const created = makeFork(freshSource, messageId, latest, { title: titleOverride, note: noteOverride });
      if (!created.conversation) {
        showToast(forkErrorMessage(created.error));
        return;
      }
      const fork = created.conversation;
      const next = [fork, ...latest].slice(0, MAX_CONVERSATIONS);
      if (!writeConversations(next)) {
        showToast('Yeni dal cihazda kalıcı olarak kaydedilemedi.');
        return;
      }
      closeDialog();
      window.dispatchEvent(new CustomEvent('hafize:conversation-forks-changed', { detail: { conversationId: freshSource.id, forkId: fork.id } }));
      window.dispatchEvent(new CustomEvent('hafize:open-conversation', { detail: { conversationId: fork.id } }));
      showToast('Yeni konuşma dalı oluşturuldu.');
    });
  }

  function decorateMessages(): void {
    messagesRoot.querySelectorAll<HTMLElement>('.message').forEach((article) => {
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

  function descendantCount(conversationId: string, all: readonly ForkConversation[], visited = new Set<string>()): number {
    if (visited.has(conversationId)) return 0;
    visited.add(conversationId);
    const children = directChildren(conversationId, all);
    return children.reduce((sum, child) => sum + 1 + descendantCount(child.id, all, visited), 0);
  }

  function downloadConversation(conversation: ForkConversation): void {
    try {
      const snapshot = buildForkSnapshot(conversation);
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'hafize-' + (cleanText(conversation.title, 48) || 'sohbet') + '.json';
      link.click();
      globalThis.setTimeout(() => URL.revokeObjectURL(url), 0);
      showToast('Dal yedeği indirildi.');
    } catch {
      showToast('Dal yedeği oluşturulamadı.');
    }
  }

  function renderActiveBranchBanner(): void {
    const all = readConversations();
    const active = currentConversation(all);
    const stage = document.querySelector<HTMLElement>('.chat-stage');
    if (!stage) return;

    const existing = document.getElementById('hafizeConversationForkBanner');
    if (!active?.forkOf) {
      existing?.remove();
      return;
    }

    const parent = all.find((item) => item.id === active.forkOf) ?? null;
    let banner = existing;
    if (!banner) {
      banner = document.createElement('aside');
      banner.id = 'hafizeConversationForkBanner';
      banner.className = 'conversation-fork-banner';
      banner.setAttribute('role', 'status');
      stage.prepend(banner);
    }

    banner.replaceChildren();

    const copy = document.createElement('div');
    copy.className = 'conversation-fork-banner-copy';
    const heading = document.createElement('strong');
    heading.textContent = 'Konuşma dalı';
    const detail = document.createElement('span');
    detail.textContent = 'Üst sohbet: ' + (parent ? cleanText(parent.title, MAX_TITLE) : 'bulunamıyor')
      + ' · Seviye ' + (Number(active.forkDepth) || 1);
    copy.append(heading, detail);

    if (typeof active.forkNote === 'string' && active.forkNote.trim()) {
      const note = document.createElement('span');
      note.textContent = cleanText(active.forkNote, 140);
      note.className = 'conversation-fork-banner-note';
      copy.append(note);
    }

    const openParent = document.createElement('button');
    openParent.type = 'button';
    openParent.className = 'mini-btn';
    openParent.textContent = 'Üst sohbete dön';
    openParent.setAttribute('aria-label', 'Bu dalın üst sohbetine dön');
    if (parent) {
      openParent.addEventListener('click', () => window.dispatchEvent(new CustomEvent('hafize:open-conversation', {
        detail: { conversationId: parent.id }
      })));
    } else {
      openParent.disabled = true;
    }

    banner.append(copy, openParent);
  }

  function renderGlobalBranchHub(): void {
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
      const headerCount = document.createElement('span');
      headerCount.className = 'conversation-fork-hub-count';
      header.append(heading, headerCount);

      const searchInput = document.createElement('input');
      searchInput.type = 'search';
      searchInput.maxLength = 80;
      searchInput.className = 'conversation-fork-hub-search';
      searchInput.placeholder = 'Dallarda ara…';
      searchInput.setAttribute('aria-label', 'Tüm konuşma dallarında ara');

      const hubList = document.createElement('div');
      hubList.className = 'conversation-fork-hub-list';
      hubList.setAttribute('role', 'list');
      panel.append(header, searchInput, hubList);
      historyBlock.before(panel);

      searchInput.addEventListener('input', () => renderGlobalBranchHub());
    }

    const search = panel.querySelector<HTMLInputElement>('.conversation-fork-hub-search');
    const list = panel.querySelector<HTMLElement>('.conversation-fork-hub-list');
    const count = panel.querySelector<HTMLElement>('.conversation-fork-hub-count');
    if (!list) return;
    const query = cleanText(search?.value || '', 80).toLocaleLowerCase('tr-TR');
    const visible = branches.filter((item) => {
      const parent = all.find((candidate) => candidate.id === item.forkOf);
      return !query || [
        item.title,
        parent?.title || '',
        item.forkMessageId || ''
      ].join(' ').toLocaleLowerCase('tr-TR').includes(query);
    });

    if (count) count.textContent = String(branches.length);
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

  function focusForkPoint(conversation: ForkConversation): void {
    const id = cleanText(conversation?.forkMessageId, 120);
    if (!id) {
      showToast('Bu sohbetin kayıtlı fork noktası yok.');
      return;
    }
    const node = messagesRoot.querySelector<HTMLElement>('[data-message-id="' + CSS.escape(id) + '"]');
    if (!node) {
      showToast('Fork noktası bu konuşmada bulunamadı.');
      return;
    }
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    node.querySelector<HTMLElement>('button')?.focus();
  }

  function renderBranchPanel(): void {
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
      const headerCount = document.createElement('span');
      headerCount.className = 'conversation-fork-count';
      header.append(heading, headerCount);

      const panelBody = document.createElement('div');
      panelBody.className = 'conversation-fork-body';
      panel.append(header, panelBody);
      historyBlock.after(panel);
    }

    const count = panel.querySelector<HTMLElement>('.conversation-fork-count');
    const body = panel.querySelector<HTMLElement>('.conversation-fork-body');
    if (!body) return;
    const children = childrenOf(active.id, all);
    if (count) count.textContent = String(children.length);
    body.replaceChildren();

    const context = document.createElement('p');
    context.className = 'conversation-fork-context';
    const parentId = active.forkOf;
    if (parentId) {
      const parent = all.find((item) => item.id === parentId);
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
    if (parentId) {
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
        detail: { conversationId: parentId }
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

  function onRefresh(): void {
    decorateMessages();
    renderBranchPanel();
    renderGlobalBranchHub();
    renderActiveBranchBanner();
  }

  function onStorage(event: StorageEvent): void {
    if (event.key === STORAGE_KEY) onRefresh();
  }

  function onKeydown(event: KeyboardEvent): void {
    if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.key.toLowerCase() !== 'f') return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.matches('input, textarea, select, button, [contenteditable="true"]')) return;
    const active = currentConversation();
    const messages: readonly ForkMessage[] = Array.isArray(active?.messages) ? active.messages : [];
    const last = messages.at(-1);
    if (!last?.id) return;
    event.preventDefault();
    createFork(last.id);
  }

  function boot(): void {
    if (mounted) return;
    mounted = true;
    observer = new MutationObserver(onRefresh);
    observer.observe(messagesRoot, { childList: true, subtree: true });
    const openHandler = (): void => onRefresh();
    const forkHandler = (): void => onRefresh();
    const storageHandler = (event: StorageEvent): void => onStorage(event);
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

  const api: ForkPublicApi = Object.freeze({
    STORAGE_KEY,
    MAX_BRANCHES_PER_PARENT,
    MAX_FORK_DEPTH: FORK_LIMITS.maxDepth,
    makeFork: (conversation: ForkConversation, messageId: string, all: readonly ForkConversation[] = [conversation]) =>
      makeFork(conversation, messageId, all),
    childrenOf,
    lineageOf,
    downloadConversation,
    createFork
  });
  (globalThis as typeof globalThis & { HafizeConversationForks?: ForkPublicApi }).HafizeConversationForks = api;

  window.addEventListener('beforeunload', () => {
    for (const off of listeners.splice(0)) off();
    observer?.disconnect();
    closeDialog();
  });
})();
