import { Disposer, on, query, safeJsonParse, boundedText } from './browser-platform.ts';

export const COMPOSER_HISTORY_STORAGE_KEY = 'hafize.composer-history.v1';
export const COMPOSER_HISTORY_SETTINGS_KEY = 'hafize.composer-history.settings.v1';
export const COMPOSER_HISTORY_LIMITS = Object.freeze({ maxItems: 40, maxText: 12000 });
export const COMPOSER_HISTORY_RETENTION = Object.freeze([0, 10, 20, 40]);
export type ComposerHistorySettings = { enabled: boolean; maxItems: number };
export type ComposerHistoryController = Readonly<{ getItems: () => string[]; add: (value: string) => boolean; navigate: (direction: number) => string | null; clear: () => boolean; getCursor: () => number; getSettings: () => ComposerHistorySettings; setSettings: (next: Partial<ComposerHistorySettings>) => boolean; destroy: () => void }>;

declare global { interface Window { HafizeComposerHistoryController?: ComposerHistoryController } }

export function normalize(value: unknown): string { return typeof value === 'string' ? value.replace(/\0/g, '').slice(0, COMPOSER_HISTORY_LIMITS.maxText) : ''; }
export function normalizeSettings(value: unknown): ComposerHistorySettings { const data = value && typeof value === 'object' ? value as { enabled?: unknown; maxItems?: unknown } : {}; const maxItems = Number(data.maxItems); return { enabled: data.enabled !== false, maxItems: COMPOSER_HISTORY_RETENTION.includes(maxItems) ? maxItems : COMPOSER_HISTORY_LIMITS.maxItems }; }
export function loadSettings(storage: Storage = localStorage): ComposerHistorySettings { try { return normalizeSettings(safeJsonParse<unknown>(storage.getItem(COMPOSER_HISTORY_SETTINGS_KEY), {})); } catch { return { enabled: true, maxItems: COMPOSER_HISTORY_LIMITS.maxItems }; } }
export function load(storage: Storage = localStorage): string[] { const settings = loadSettings(storage); if (!settings.enabled || settings.maxItems === 0) return []; try { const value = safeJsonParse<unknown>(storage.getItem(COMPOSER_HISTORY_STORAGE_KEY), []); return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map(normalize).slice(0, Math.min(COMPOSER_HISTORY_LIMITS.maxItems, settings.maxItems)) : []; } catch { return []; } }
export function save(items: string[], storage: Storage = localStorage): boolean { const settings = loadSettings(storage); try { if (!settings.enabled || settings.maxItems === 0) { storage.removeItem(COMPOSER_HISTORY_STORAGE_KEY); return true; } storage.setItem(COMPOSER_HISTORY_STORAGE_KEY, JSON.stringify(items.map(normalize).filter((item) => item.trim()).slice(0, Math.min(COMPOSER_HISTORY_LIMITS.maxItems, settings.maxItems)))); return true; } catch { return false; } }
export function saveSettings(next: Partial<ComposerHistorySettings>, storage: Storage = localStorage): boolean { const settings = normalizeSettings({ ...loadSettings(storage), ...next }); try { storage.setItem(COMPOSER_HISTORY_SETTINGS_KEY, JSON.stringify(settings)); if (!settings.enabled || settings.maxItems === 0) storage.removeItem(COMPOSER_HISTORY_STORAGE_KEY); return true; } catch { return false; } }

export function mountComposerHistory(documentRef: Document = document, rootRef: Window = window): ComposerHistoryController | null {
  const input = query<HTMLTextAreaElement>(documentRef, '#messageInput'); if (!input) return null;
  const form = input.closest('form'); const disposer = new Disposer(); let items = load(rootRef.localStorage); let cursor = -1; let draft = ''; let navigating = false; let composing = false;
  const emit = () => input.dispatchEvent(new Event('input', { bubbles: true }));
  const insert = (value: string) => { input.value = normalize(value); emit(); };
  const rememberDraft = () => { if (cursor === -1) draft = normalize(input.value); };
  const reset = () => { if (!navigating) cursor = -1; navigating = false; };
  const refresh = () => { items = load(rootRef.localStorage); if (cursor >= items.length) cursor = -1; };
  const add = (value: string) => { const clean = normalize(value).trim(); const settings = loadSettings(rootRef.localStorage); if (!clean || !settings.enabled || settings.maxItems === 0) return false; items = [clean, ...items.filter((item) => item !== clean)].slice(0, settings.maxItems); return save(items, rootRef.localStorage); };
  const navigate = (direction: number) => { if (!items.length) return null; rememberDraft(); navigating = true; cursor = cursor < 0 ? direction < 0 ? 0 : items.length - 1 : Math.max(0, Math.min(items.length - 1, cursor + direction)); const value = items[cursor] ?? null; if (value !== null) insert(value); navigating = false; return value; };
  const restoreDraft = () => { cursor = -1; const value = draft; insert(value); return value; };
  const onInput = () => reset();
  const onKeydown = (event: KeyboardEvent) => { if (event.isComposing || composing || !loadSettings(rootRef.localStorage).enabled || !['ArrowUp', 'ArrowDown'].includes(event.key)) return; if (input.selectionStart !== 0 && input.selectionStart !== input.value.length) return; event.preventDefault(); if (event.key === 'ArrowUp') { navigate(-1); return; } if (cursor < 0) return; if (cursor >= items.length - 1) restoreDraft(); else navigate(1); };
  const onComposition = (event: Event) => { composing = event.type === 'compositionstart'; };
  const onSubmit = () => { add(input.value); cursor = -1; draft = ''; };
  const onStorage = (event: Event) => { const storageEvent = event as StorageEvent; if (storageEvent.key === COMPOSER_HISTORY_STORAGE_KEY || storageEvent.key === COMPOSER_HISTORY_SETTINGS_KEY) refresh(); };
  on(input, 'input', onInput, undefined, disposer); on(input, 'keydown', onKeydown, undefined, disposer); on(input, 'compositionstart', onComposition, undefined, disposer); on(input, 'compositionend', onComposition, undefined, disposer); on(form, 'submit', onSubmit, undefined, disposer); on(rootRef, 'storage', onStorage, undefined, disposer);
  const controller: ComposerHistoryController = Object.freeze({ getItems: () => items.slice(), add, navigate, clear: () => { items = []; return save(items, rootRef.localStorage); }, getCursor: () => cursor, getSettings: () => ({ ...loadSettings(rootRef.localStorage) }), setSettings: (next: Partial<ComposerHistorySettings>) => { const ok = saveSettings(next, rootRef.localStorage); refresh(); return ok; }, destroy: () => disposer.flush() });
  rootRef.HafizeComposerHistoryController = controller;
  return controller;
}

const start = () => mountComposerHistory(document, window);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
