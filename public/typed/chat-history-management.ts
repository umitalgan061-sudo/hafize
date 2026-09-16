import { Disposer, on, query, safeJsonParse, boundedText, text, writeStorage } from './browser-platform.ts';

export const CHAT_HISTORY_MANAGEMENT_KEY = 'hafize.conversations.v1';
export const CHAT_HISTORY_MANAGEMENT_LIMITS = Object.freeze({ maxItems: 30, maxTitle: 80 });

export type ManagedConversation = { id?: unknown; title?: unknown; pinned?: unknown; messages?: unknown } & Record<string, unknown>;

export function readHistory(storage: Storage = localStorage): ManagedConversation[] { const value = safeJsonParse<unknown>(storage.getItem(CHAT_HISTORY_MANAGEMENT_KEY), []); return Array.isArray(value) ? value.filter((item): item is ManagedConversation => Boolean(item && typeof item === 'object')) : []; }
export function writeHistory(conversations: ManagedConversation[], storage: Storage = localStorage): boolean { try { storage.setItem(CHAT_HISTORY_MANAGEMENT_KEY, JSON.stringify(conversations.slice(0, CHAT_HISTORY_MANAGEMENT_LIMITS.maxItems))); return true; } catch { return false; } }
export function normalizeTitle(value: unknown): string { return boundedText(String(value ?? '').trim().replace(/\s+/g, ' '), CHAT_HISTORY_MANAGEMENT_LIMITS.maxTitle); }

function getRowId(row: HTMLElement): string { return row.querySelector('.conversation-open')?.getAttribute('data-conversation-id') || ''; }
function button(documentRef: Document, label: string, aria: string, className = 'history-manage-btn'): HTMLButtonElement { const node = text<HTMLButtonElement>(documentRef, 'button', label, className); node.type = 'button'; node.setAttribute('aria-label', aria); return node; }

export function mountChatHistoryManagement(documentRef: Document = document, rootRef: Window = window): Readonly<{ sync: () => void; destroy: () => void }> | null {
  const list = query<HTMLElement>(documentRef, '#conversationList'); if (!list) return null;
  const disposer = new Disposer();
  const announce = (message: string) => { const toast = query<HTMLElement>(documentRef, '#toast'); if (!toast) return; toast.textContent = message; toast.classList.remove('hidden'); const timer = Number(toast.dataset.hafizeHistoryTimer || 0); if (timer) rootRef.clearTimeout(timer); toast.dataset.hafizeHistoryTimer = String(rootRef.setTimeout(() => toast.classList.add('hidden'), 2600)); };
  const find = (id: string) => readHistory(rootRef.localStorage).find((item) => item.id === id) || null;
  const mutate = (id: string, updater: (item: ManagedConversation) => void) => { const history = readHistory(rootRef.localStorage); const item = history.find((candidate) => candidate.id === id); if (!item) return false; updater(item); return writeHistory(history, rootRef.localStorage); };
  const closeRename = (row: HTMLElement) => row.querySelector('.history-rename')?.remove();
  const rename = (row: HTMLElement, conversation: ManagedConversation) => {
    closeRename(row); const form = text<HTMLElement>(documentRef, 'div', '', 'history-rename'); form.setAttribute('role', 'group'); form.setAttribute('aria-label', 'Sohbet adını düzenle');
    const input = documentRef.createElement('input'); input.type = 'text'; input.maxLength = CHAT_HISTORY_MANAGEMENT_LIMITS.maxTitle; input.value = normalizeTitle(conversation.title || 'Yeni sohbet'); input.setAttribute('aria-label', 'Yeni sohbet adı');
    const actions = text<HTMLElement>(documentRef, 'div', '', 'history-rename-actions'); const cancel = button(documentRef, 'Vazgeç', 'Sohbet adını değiştirmeyi iptal et'); const save = button(documentRef, 'Kaydet', 'Sohbet adını kaydet'); save.classList.add('primary');
    const commit = () => { const title = normalizeTitle(input.value); if (!title) return announce('Sohbet adı boş olamaz.'); if (!mutate(String(conversation.id), (item) => { item.title = title; })) return; const open = row.querySelector<HTMLElement>('.conversation-open'); if (open) { open.textContent = title; open.title = title; } closeRename(row); announce('Sohbet adı güncellendi.'); };
    on(cancel, 'click', () => closeRename(row), undefined, disposer); on(save, 'click', commit, undefined, disposer); on(input, 'keydown', ((event: Event) => { const key = (event as KeyboardEvent).key; if (key === 'Enter') { event.preventDefault(); commit(); } else if (key === 'Escape') { event.preventDefault(); closeRename(row); } }) as EventListener, undefined, disposer);
    actions.append(cancel, save); form.append(input, actions); row.append(form); input.focus(); input.select();
  };
  const decorate = (row: HTMLElement, conversation: ManagedConversation) => {
    const open = row.querySelector<HTMLElement>('.conversation-open'); if (!open || typeof conversation.id !== 'string') return; open.dataset.conversationId = conversation.id; row.classList.toggle('pinned', conversation.pinned === true); if (typeof conversation.title === 'string') { open.textContent = normalizeTitle(conversation.title) || 'Yeni sohbet'; open.title = open.textContent; }
    row.querySelector('.history-manage')?.remove(); const manage = text<HTMLElement>(documentRef, 'div', '', 'history-manage'); manage.setAttribute('aria-label', 'Sohbet işlemleri');
    const pin = button(documentRef, conversation.pinned === true ? '◆' : '◇', conversation.pinned === true ? 'Sohbet sabitlemesini kaldır' : 'Sohbeti sabitle'); pin.setAttribute('aria-pressed', String(conversation.pinned === true)); pin.title = conversation.pinned === true ? 'Sabitlemeyi kaldır' : 'Sohbeti sabitle';
    const edit = button(documentRef, '✎', 'Sohbet adını değiştir'); edit.title = 'Sohbet adını değiştir'; manage.append(pin, edit); row.append(manage);
    on(pin, 'click', ((event: Event) => { event.preventDefault(); event.stopPropagation(); const current = find(conversation.id as string); const next = !Boolean(current?.pinned); if (!mutate(conversation.id as string, (item) => { item.pinned = next; })) return; sync(); announce(next ? 'Sohbet sabitlendi.' : 'Sohbet sabitlemesi kaldırıldı.'); }) as EventListener, undefined, disposer);
    on(edit, 'click', ((event: Event) => { event.preventDefault(); event.stopPropagation(); const current = find(conversation.id as string); if (current) rename(row, current); }) as EventListener, undefined, disposer);
  };
  const sync = () => { const history = readHistory(rootRef.localStorage); if (!history.length) return; const rows = [...list.querySelectorAll<HTMLElement>('.conversation-row')]; rows.forEach((row, index) => { const id = getRowId(row); const conversation = history.find((item) => item.id === id) || history[index]; if (conversation) decorate(row, conversation); }); rows.sort((a, b) => Number(b.classList.contains('pinned')) - Number(a.classList.contains('pinned'))); rows.forEach((row) => list.append(row)); };
  const observer = new MutationObserver(sync); observer.observe(list, { childList: true, subtree: true }); disposer.add(() => observer.disconnect()); on(rootRef, 'storage', ((event: Event) => { if ((event as StorageEvent).key === CHAT_HISTORY_MANAGEMENT_KEY) sync(); }) as EventListener, undefined, disposer); sync();
  return Object.freeze({ sync, destroy: () => disposer.flush() });
}

const start = () => mountChatHistoryManagement(document, window);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
