import { Disposer, boundedText, on, query, safeJsonParse, writeStorage } from './browser-platform.ts';

export const DRAFT_LIMITS = Object.freeze({ length: 12000, count: 30, delay: 250 });
const STORAGE_KEY = 'hafize.chat-drafts.v1';
const CONVERSATION_KEY = 'hafize.conversations.v1';
const STATUS_ID = 'chatDraftStatus';

type DraftStore = Record<string, string>;

function normalizeDraft(value: unknown): string { return typeof value === 'string' ? value.slice(0, DRAFT_LIMITS.length) : ''; }
function readStore(storage: Storage): DraftStore { const raw = safeJsonParse<unknown>(storage.getItem(STORAGE_KEY), {}); return raw && typeof raw === 'object' && !Array.isArray(raw) ? Object.fromEntries(Object.entries(raw).map(([id, value]) => [id, normalizeDraft(value)])) : {}; }
function readConversationIds(storage: Storage): Set<string> { const raw = safeJsonParse<unknown>(storage.getItem(CONVERSATION_KEY), []); return new Set(Array.isArray(raw) ? raw.map((item) => item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string' ? (item as { id: string }).id : '').filter(Boolean) : []); }

export function sanitizeStore(value: DraftStore, ids: Set<string>): DraftStore { return Object.fromEntries(Object.entries(value).filter(([id, draft]) => ids.has(id) && normalizeDraft(draft).trim()).map(([id, draft]) => [id, normalizeDraft(draft)]).slice(-DRAFT_LIMITS.count)); }
export function activeConversationId(documentRef: Document): string { return query<HTMLElement>(documentRef, '.conversation-row.active .conversation-open')?.dataset.conversationId || ''; }

export function mountDrafts(documentRef: Document = document, rootRef: Window = window): Readonly<{ save: () => boolean; clear: (id?: string) => boolean; restore: () => void; destroy: () => void }> | null {
  const input = query<HTMLTextAreaElement>(documentRef, '#messageInput'); const composer = query<HTMLFormElement>(documentRef, '#composer'); const list = query<HTMLElement>(documentRef, '#conversationList');
  if (!input || !composer || !list) return null;
  const storage = rootRef.localStorage; const disposer = new Disposer(); let timer = 0; let lastConversationId = ''; let lastPersistedDraft = ''; let lastSavedAt = '';
  const announce = (message: string) => { let node = documentRef.getElementById(STATUS_ID); if (!node) { node = documentRef.createElement('span'); node.id = STATUS_ID; node.className = 'chat-draft-status'; node.setAttribute('role', 'status'); node.setAttribute('aria-live', 'polite'); composer.append(node); } node.textContent = boundedText(message, 120); node.hidden = !message; };
  const read = () => readStore(storage);
  const write = (value: DraftStore) => { try { storage.setItem(STORAGE_KEY, JSON.stringify(sanitizeStore(value, readConversationIds(storage)))); return true; } catch { return false; } };
  const cleanup = () => { const current = read(); const clean = sanitizeStore(current, readConversationIds(storage)); if (JSON.stringify(current) === JSON.stringify(clean)) return false; return write(clean); };
  const get = (id = activeConversationId(documentRef)) => id ? normalizeDraft(read()[id]) : '';
  const save = (silent = false) => { const id = activeConversationId(documentRef); if (!id) return false; const value = normalizeDraft(input.value); const store = read(); if (value.trim()) store[id] = value; else delete store[id]; const ok = write(store); if (ok) { lastPersistedDraft = value; lastSavedAt = new Date().toISOString(); } if (!silent && ok) announce(value.trim() ? `Taslak kaydedildi · ${new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' }).format(new Date(lastSavedAt))}` : 'Taslak temizlendi'); if (!ok && !silent) announce('Taslak bu cihazda kaydedilemedi'); lastConversationId = id; return ok; };
  const flush = () => { if (!timer) return false; rootRef.clearTimeout(timer); timer = 0; return save(true); };
  const restore = () => { const id = activeConversationId(documentRef); if (!id || id === lastConversationId) return; flush(); const draft = get(id); input.value = draft; if (draft) { input.dispatchEvent(new Event('input', { bubbles: true })); announce(`Taslak geri yüklendi · ${draft.length} karakter`); } else announce(''); lastPersistedDraft = draft; lastSavedAt = ''; lastConversationId = id; };
  const schedule = () => { rootRef.clearTimeout(timer); timer = rootRef.setTimeout(() => { timer = 0; save(); }, DRAFT_LIMITS.delay); announce('Taslak kaydediliyor…'); };
  const clear = (id = activeConversationId(documentRef)) => { if (!id) return false; const store = read(); if (!Object.prototype.hasOwnProperty.call(store, id)) return true; delete store[id]; const ok = write(store); if (ok) lastPersistedDraft = ''; return ok; };
  const onInput = () => { if (!input.value.trim()) announce(''); else schedule(); };
  const onSubmit = () => { flush(); clear(); announce(''); };
  const sync = () => { cleanup(); restore(); };
  on(input, 'input', onInput, undefined, disposer); on(composer, 'submit', onSubmit, true, disposer); on(rootRef, 'storage', ((event: StorageEvent) => { if (event.key === STORAGE_KEY || event.key === CONVERSATION_KEY) sync(); }) as EventListener, undefined, disposer);
  on(rootRef, 'pagehide', flush as EventListener, { capture: true }, disposer); on(rootRef, 'beforeunload', flush as EventListener, { capture: true }, disposer); on(documentRef, 'visibilitychange', () => { if (documentRef.visibilityState === 'hidden') flush(); }, undefined, disposer);
  const observer = new MutationObserver(sync); observer.observe(list, { childList: true, subtree: true }); disposer.add(() => observer.disconnect()); cleanup(); sync();
  return Object.freeze({ save: () => save(), clear, restore, destroy: () => { rootRef.clearTimeout(timer); disposer.flush(); } });
}

const start = () => mountDrafts(document, window);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
