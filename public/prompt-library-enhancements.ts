interface PromptLibraryItem {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly favorite?: boolean;
  readonly useCount?: number;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}
interface PromptLibraryApi {
  readonly loadItems?: (storage: Storage) => PromptLibraryItem[];
  readonly saveItems?: (storage: Storage, items: readonly PromptLibraryItem[]) => boolean;
  readonly normalizeItem?: (value: PromptLibraryItem) => PromptLibraryItem | null;
  readonly saveState?: (storage: Storage, state: unknown) => boolean;
}
interface EnhancementRoot extends Window {
  HafizePromptLibrary?: PromptLibraryApi;
  HafizePromptLibraryStarters?: { seed?: (options?: { force?: boolean }) => boolean };
}

type EnhancementAction = 'copy' | 'duplicate' | 'restore-starters' | 'clear-filters' | 'bulk-clear' | 'bulk-delete';
const root = globalThis as EnhancementRoot;
const STORAGE_KEY = 'hafize.prompt-library.v1';
const MAX_ITEMS = 120;
const MAX_SELECTION = 40;
let mounted = false;
let observer: MutationObserver | null = null;

const api = (): PromptLibraryApi | undefined => root.HafizePromptLibrary;
const storage = (): Storage => root.localStorage;
const load = (): PromptLibraryItem[] => api()?.loadItems?.(storage()) ?? [];
const persist = (items: readonly PromptLibraryItem[]): boolean => api()?.saveItems?.(storage(), items) === true;

function report(message: string): void {
  const status = root.document?.querySelector<HTMLElement>('#promptLibraryCard .prompt-library-status');
  if (!status) return;
  const value = message.slice(0, 180);
  status.textContent = value;
  root.setTimeout(() => { if (status.textContent === value) status.textContent = ''; }, 3200);
}

function makeButton(label: string, action: EnhancementAction): HTMLButtonElement {
  const node = root.document.createElement('button');
  node.type = 'button'; node.className = 'soft-btn prompt-enhancement-action'; node.textContent = label;
  node.dataset.promptEnhancement = action; node.setAttribute('aria-label', label); return node;
}

function syncCore(): void {
  try { root.dispatchEvent(new root.StorageEvent('storage', { key: STORAGE_KEY, newValue: JSON.stringify(load()), storageArea: storage() })); }
  catch { root.dispatchEvent(new root.Event('hafize:prompt-library-refresh')); }
}

async function copyItem(item: PromptLibraryItem): Promise<void> {
  const write = root.navigator.clipboard?.writeText;
  if (!write) return report('Panoya kopyalama kullanılamıyor.');
  try { await write.call(root.navigator.clipboard, item.body); report('İstem panoya kopyalandı.'); }
  catch { report('Panoya kopyalama kullanılamıyor.'); }
}

function duplicateItem(item: PromptLibraryItem): void {
  const items = load(); if (items.length >= MAX_ITEMS) return report('Kütüphane sınırı dolu.');
  const now = new Date().toISOString();
  const id = root.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const copy = api()?.normalizeItem?.({ ...item, id, title: `${item.title} kopyası`, createdAt: now, updatedAt: now, favorite: false, useCount: 0 });
  if (!copy || !persist([copy, ...items])) return report('İstem çoğaltılamadı.');
  syncCore(); report('İstem çoğaltıldı.');
}

function clearFilters(): void {
  api()?.saveState?.(storage(), { query: '', tag: 'all', favoriteOnly: false, sort: 'updated-desc' });
  root.document.querySelector<HTMLInputElement>('#promptLibrarySearch')?.focus();
  syncCore(); report('İstem filtreleri sıfırlandı.');
}

function selectedIds(card: HTMLElement): string[] {
  return [...card.querySelectorAll<HTMLInputElement>('[data-prompt-selection]:checked')].map((node) => node.dataset.promptSelection || '').filter(Boolean).slice(0, MAX_SELECTION);
}

function onClick(event: Event): void {
  const target = (event.target as Element | null)?.closest<HTMLButtonElement>('[data-prompt-enhancement]');
  if (!target) return;
  const action = target.dataset.promptEnhancement as EnhancementAction | undefined;
  const card = root.document.querySelector<HTMLElement>('#promptLibraryCard'); if (!card || !action) return;
  const item = load().find((candidate) => candidate.id === target.closest<HTMLElement>('.prompt-item')?.dataset.promptId);
  if (action === 'copy' && item) void copyItem(item);
  else if (action === 'duplicate' && item) duplicateItem(item);
  else if (action === 'restore-starters') { const changed = root.HafizePromptLibraryStarters?.seed?.({ force: true }) ?? false; syncCore(); report(changed ? 'Eksik başlangıç istemleri eklendi.' : 'Başlangıç istemlerinin tamamı zaten mevcut.'); }
  else if (action === 'clear-filters') clearFilters();
  else if (action === 'bulk-clear') { card.querySelectorAll<HTMLInputElement>('[data-prompt-selection]').forEach((node) => { node.checked = false; }); enhance(); }
  else if (action === 'bulk-delete') { const ids = new Set(selectedIds(card)); if (!ids.size) return report('Seçili istem yok.'); if (!root.confirm?.(`${ids.size} istem silinsin mi?`)) return; if (!persist(load().filter((candidate) => !ids.has(candidate.id)))) return report('Seçilen istemler silinemedi.'); syncCore(); report('Seçilen istemler silindi.'); }
}

function enhance(): void {
  const card = root.document?.querySelector<HTMLElement>('#promptLibraryCard'); const list = card?.querySelector<HTMLElement>('#promptLibraryList'); if (!card || !list) return;
  let toolbar = card.querySelector<HTMLElement>('.prompt-library-enhancement-toolbar');
  if (!toolbar) { toolbar = root.document.createElement('div'); toolbar.className = 'prompt-library-enhancement-toolbar'; toolbar.append(makeButton('Filtreleri sıfırla', 'clear-filters'), makeButton('Başlangıç seti', 'restore-starters')); card.querySelector('.prompt-library-filters')?.after(toolbar); toolbar.addEventListener('click', onClick); }
  list.querySelectorAll<HTMLElement>('.prompt-item').forEach((row) => { const id = row.dataset.promptId; const actions = row.querySelector<HTMLElement>('.prompt-item-actions'); if (!id || !actions || actions.querySelector('[data-prompt-enhancement="copy"]')) return; actions.append(makeButton('Kopyala', 'copy'), makeButton('Çoğalt', 'duplicate')); row.querySelector<HTMLInputElement>('input[type="checkbox"]')?.setAttribute('data-prompt-selection', id); });
  const hasSelection = selectedIds(card).length > 0; const existingBulk = list.querySelector<HTMLElement>('.prompt-library-enhancement-bulk');
  if (hasSelection && !existingBulk) { const bulk = root.document.createElement('div'); bulk.className = 'prompt-library-enhancement-bulk'; bulk.append(makeButton('Seçilenleri sil', 'bulk-delete'), makeButton('Seçimi kaldır', 'bulk-clear')); list.prepend(bulk); bulk.addEventListener('click', onClick); } else if (!hasSelection) existingBulk?.remove();
}

export function installPromptLibraryEnhancements(documentRef: Document = root.document): void {
  if (mounted || !api() || !documentRef) return;
  const card = documentRef.querySelector<HTMLElement>('#promptLibraryCard'); if (!card) return;
  mounted = true; observer = new MutationObserver(enhance); observer.observe(card, { childList: true, subtree: true }); enhance();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => installPromptLibraryEnhancements(document), { once: true }); else installPromptLibraryEnhancements(document);
