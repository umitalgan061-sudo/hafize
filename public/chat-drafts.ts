export interface DraftStore { readonly read: () => Readonly<Record<string, string>>; readonly get: (conversationId: string) => string; readonly set: (conversationId: string, value: string) => boolean; readonly clear: (conversationId: string) => boolean; readonly cleanup: () => boolean; }
interface DraftRoot extends Window { readonly localStorage: Storage; }

const root = globalThis as DraftRoot;
const STORAGE_KEY = 'hafize.chat-drafts.v1';
const CONVERSATION_KEY = 'hafize.conversations.v1';
const MAX_DRAFT_LENGTH = 12_000;
const MAX_DRAFTS = 30;

function normalize(value: unknown): string { return typeof value === 'string' ? value.slice(0, MAX_DRAFT_LENGTH) : ''; }
function readObject(storage: Storage): Record<string, string> { try { const value: unknown = JSON.parse(storage.getItem(STORAGE_KEY) || '{}'); if (!value || typeof value !== 'object' || Array.isArray(value)) return {}; return Object.fromEntries(Object.entries(value).filter(([, draft]) => typeof draft === 'string').map(([id, draft]) => [id, normalize(draft)])); } catch { return {}; } }
function conversationIds(storage: Storage): Set<string> { try { const value: unknown = JSON.parse(storage.getItem(CONVERSATION_KEY) || '[]'); return new Set(Array.isArray(value) ? value.map((item) => item && typeof item === 'object' && typeof (item as Record<string, unknown>).id === 'string' ? String((item as Record<string, unknown>).id) : '').filter(Boolean) : []); } catch { return new Set(); } }
function sanitize(store: Record<string, string>, ids: Set<string>): Record<string, string> { const entries = Object.entries(store).filter(([id, draft]) => ids.has(id) && Boolean(normalize(draft).trim())).map(([id, draft]) => [id, normalize(draft)] as const).slice(-MAX_DRAFTS); return Object.fromEntries(entries); }

export function createDraftStore(storage: Storage = root.localStorage): DraftStore {
  const read = (): Readonly<Record<string, string>> => sanitize(readObject(storage), conversationIds(storage));
  const write = (value: Record<string, string>): boolean => { try { storage.setItem(STORAGE_KEY, JSON.stringify(sanitize(value, conversationIds(storage)))); return true; } catch { return false; } };
  const get = (conversationId: string): string => conversationId ? normalize(read()[conversationId]) : '';
  const set = (conversationId: string, value: string): boolean => { if (!conversationId) return false; const store = { ...readObject(storage) }; const next = normalize(value); if (next.trim()) store[conversationId] = next; else delete store[conversationId]; return write(store); };
  const clear = (conversationId: string): boolean => set(conversationId, '');
  const cleanup = (): boolean => { const before = JSON.stringify(readObject(storage)); const after = JSON.stringify(read()); if (before === after) return false; try { storage.setItem(STORAGE_KEY, after); return true; } catch { return false; } };
  return Object.freeze({ read, get, set, clear, cleanup });
}

function installUi(documentRef: Document = document, rootRef: DraftRoot = root): void {
  const input = documentRef.querySelector<HTMLTextAreaElement>('#messageInput'); const composer = documentRef.querySelector<HTMLFormElement>('#composer'); const list = documentRef.querySelector<HTMLElement>('#conversationList'); if (!input || !composer || !list) return;
  const store = createDraftStore(rootRef.localStorage); let timer: number | undefined; let lastConversationId = '';
  const activeConversationId = (): string => list.querySelector<HTMLElement>('.conversation-row.active')?.querySelector<HTMLElement>('[data-conversation-id]')?.getAttribute('data-conversation-id') || '';
  const status = (message: string): void => { let node = documentRef.getElementById('chatDraftStatus'); if (!node) { node = documentRef.createElement('span'); node.id = 'chatDraftStatus'; node.className = 'chat-draft-status'; node.setAttribute('role', 'status'); node.setAttribute('aria-live', 'polite'); composer.append(node); } node.textContent = message; node.hidden = !message; };
  const flush = (): boolean => { if (timer !== undefined) rootRef.clearTimeout(timer); timer = undefined; const id = activeConversationId(); if (!id) return false; const ok = store.set(id, input.value); if (ok) status(input.value.trim() ? 'Taslak kaydedildi' : ''); return ok; };
  const restore = (): void => { const id = activeConversationId(); if (!id || id === lastConversationId) return; flush(); const draft = store.get(id); if (draft && !input.value) { input.value = draft; input.dispatchEvent(new Event('input', { bubbles: true })); status(`Taslak geri yüklendi · ${draft.length} karakter`); } else status(''); lastConversationId = id; };
  const schedule = (): void => { if (timer !== undefined) rootRef.clearTimeout(timer); timer = rootRef.setTimeout(() => { timer = undefined; void flush(); }, 250); status(input.value.trim() ? 'Taslak kaydediliyor…' : ''); };
  input.addEventListener('input', schedule); composer.addEventListener('submit', () => { flush(); const id = activeConversationId(); if (id) store.clear(id); status(''); }, true); window.addEventListener('pagehide', flush, { capture: true }); documentRef.addEventListener('visibilitychange', () => { if (documentRef.visibilityState === 'hidden') flush(); }); window.addEventListener('storage', (event) => { if (event.key === STORAGE_KEY || event.key === CONVERSATION_KEY) { store.cleanup(); restore(); } });
  store.cleanup(); restore();
}

const boot = (): void => { installUi(); };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
