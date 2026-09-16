import { Disposer, on, query, safeJsonParse, boundedText, text } from './browser-platform.ts';

export const CHAT_HISTORY_SEARCH_LIMITS = Object.freeze({ query: 120 });
export const CHAT_HISTORY_STORAGE_KEY = 'hafize.conversations.v1';
export const CHAT_HISTORY_SHORTCUT = Object.freeze({ key: 'f', ctrlOrMeta: true, shift: true });

type Conversation = { title?: unknown; agentId?: unknown; messages?: unknown };

type SearchUi = {
  section: HTMLElement;
  input: HTMLInputElement;
  clear: HTMLButtonElement;
  status: HTMLElement;
};

export function normalize(value: unknown): string {
  return typeof value === 'string' ? value.toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').trim() : '';
}

export function searchableText(conversation: Conversation | null | undefined): string {
  const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
  return normalize([
    conversation?.title,
    conversation?.agentId,
    ...messages.map((message) => message && typeof message === 'object' ? (message as { content?: unknown }).content : undefined)
  ].filter((value): value is string => typeof value === 'string').join(' '));
}

export function readConversations(storage: Storage = localStorage): Conversation[] {
  try {
    const parsed = safeJsonParse<unknown>(storage.getItem(CHAT_HISTORY_STORAGE_KEY), []);
    return Array.isArray(parsed) ? parsed.filter((item): item is Conversation => Boolean(item && typeof item === 'object')) : [];
  } catch { return []; }
}

function createSearchUi(documentRef: Document, block: HTMLElement): SearchUi {
  const section = text<HTMLElement>(documentRef, 'section', '', 'history-search');
  section.setAttribute('aria-label', 'Sohbet geçmişinde ara');
  const label = text<HTMLLabelElement>(documentRef, 'label', 'Sohbetlerde ara', 'history-search-label');
  label.htmlFor = 'conversationSearchInput';
  const row = text<HTMLElement>(documentRef, 'div', '', 'history-search-row');
  const input = documentRef.createElement('input'); input.id = 'conversationSearchInput'; input.className = 'history-search-input'; input.type = 'search'; input.autocomplete = 'off'; input.spellcheck = false; input.placeholder = 'Başlık veya mesaj…'; input.maxLength = CHAT_HISTORY_SEARCH_LIMITS.query; input.setAttribute('aria-describedby', 'conversationSearchStatus');
  const clear = text<HTMLButtonElement>(documentRef, 'button', '×', 'history-search-clear'); clear.type = 'button'; clear.setAttribute('aria-label', 'Sohbet aramasını temizle'); clear.hidden = true;
  const status = text<HTMLElement>(documentRef, 'div', '', 'history-search-status'); status.id = 'conversationSearchStatus'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  row.append(input, clear); section.append(label, row, status); block.insertBefore(section, block.querySelector('.history-head')?.nextSibling || block.firstChild || null);
  return { section, input, clear, status };
}

export function mountChatHistorySearch(documentRef: Document = document, rootRef: Window = window): Readonly<{ destroy: () => void; render: () => void }> | null {
  const history = query<HTMLElement>(documentRef, '#conversationList');
  const block = query<HTMLElement>(documentRef, '.history-block');
  if (!history || !block || documentRef.getElementById('conversationSearchInput')) return null;
  const searchUi = createSearchUi(documentRef, block); const disposer = new Disposer(); let queryText = ''; let queued = false; let frame = 0;
  const rows = () => [...history.querySelectorAll<HTMLElement>('.conversation-row')];
  const render = () => {
    const q = normalize(queryText); const stored = readConversations(rootRef.localStorage); const currentRows = rows();
    const byTitle = new Map(stored.map((conversation) => [normalize(conversation.title), conversation])); let visible = 0;
    for (const row of currentRows) {
      const title = normalize(row.querySelector('.conversation-open')?.textContent || '');
      const conversation = byTitle.get(title); const haystack = conversation ? searchableText(conversation) : title; const matches = !q || haystack.includes(q);
      row.hidden = !matches; if (matches) visible += 1;
    }
    searchUi.clear.hidden = !q;
    searchUi.status.textContent = !currentRows.length ? 'Henüz sohbet yok.' : !q ? `${currentRows.length} sohbet` : `${visible} / ${currentRows.length} sohbet eşleşti`;
    let empty = history.querySelector<HTMLElement>('.history-search-empty');
    if (q && currentRows.length > 0 && visible === 0) {
      if (!empty) { empty = text<HTMLElement>(documentRef, 'div', '', 'history-search-empty'); empty.setAttribute('role', 'status'); history.append(empty); }
      empty.textContent = 'Aramanla eşleşen sohbet bulunamadı.';
    } else empty?.remove();
  };
  const queueRender = () => { if (queued) return; queued = true; frame = rootRef.requestAnimationFrame?.(() => { queued = false; frame = 0; render(); }) ?? 0; };
  const onInput = () => { queryText = boundedText(searchUi.input.value, CHAT_HISTORY_SEARCH_LIMITS.query); queueRender(); };
  const onEscape = (event: KeyboardEvent) => { if (event.key !== 'Escape' || !searchUi.input.value) return; event.preventDefault(); searchUi.input.value = ''; queryText = ''; queueRender(); };
  const onClear = () => { searchUi.input.value = ''; queryText = ''; queueRender(); searchUi.input.focus(); };
  const onDocumentKey = (event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || !event.shiftKey || event.key.toLocaleLowerCase() !== 'f') return;
    const target = event.target as HTMLElement | null; if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) && target !== searchUi.input) return;
    event.preventDefault(); searchUi.input.focus(); searchUi.input.select();
  };
  const observer = new MutationObserver(queueRender);
  observer.observe(history, { childList: true, subtree: true }); disposer.add(() => observer.disconnect());
  disposer.add(() => { if (frame) rootRef.cancelAnimationFrame(frame); });
  on(searchUi.input, 'input', onInput, undefined, disposer); on(searchUi.input, 'keydown', onEscape, undefined, disposer); on(searchUi.clear, 'click', onClear, undefined, disposer); on(documentRef, 'keydown', onDocumentKey, undefined, disposer);
  on(rootRef, 'storage', ((event: StorageEvent) => { if (event.key === CHAT_HISTORY_STORAGE_KEY) queueRender(); }) as EventListener, undefined, disposer);
  render();
  return Object.freeze({ render, destroy: () => { disposer.flush(); searchUi.section.remove(); } });
}

const start = () => mountChatHistorySearch(document, window);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
