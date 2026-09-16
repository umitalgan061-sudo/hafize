interface PromptRecord {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly favorite?: boolean;
  readonly tags?: readonly string[];
  readonly updatedAt?: string;
}

interface PromptLibraryCore {
  readonly loadItems?: (storage: Storage) => PromptRecord[];
  readonly extractVariables?: (body: string) => string[];
}

interface SmartFillBridge {
  readonly open?: (item: PromptRecord) => void;
}

interface PaletteWindow extends Window {
  HafizePromptLibrary?: PromptLibraryCore;
  HafizePromptLibrarySmartFill?: SmartFillBridge;
  PromptLibraryCommandPalette?: Readonly<{ mount: () => PaletteController | null; results: (query: string) => PromptRecord[] }>;
}

export interface PaletteController {
  readonly mounted: true;
  readonly open: (start: number) => void;
  readonly close: () => void;
  readonly search: (query: string) => PromptRecord[];
  readonly destroy: () => void;
}

const root = globalThis as PaletteWindow;
const CARD_ID = 'promptLibraryCard';
const INPUT_ID = 'messageInput';
const PALETTE_ID = 'promptLibraryCommandPalette';
const MAX_RESULTS = 12;
const MAX_QUERY = 120;

function make<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function loadItems(): PromptRecord[] {
  try {
    const core = root.HafizePromptLibrary;
    return core?.loadItems?.(root.localStorage) ?? [];
  } catch {
    return [];
  }
}

function score(item: PromptRecord, query: string): number {
  const q = query.toLocaleLowerCase('tr-TR').trim();
  if (!q) return 0;
  const title = String(item.title || '').toLocaleLowerCase('tr-TR');
  const tags = (item.tags || []).join(' ').toLocaleLowerCase('tr-TR');
  const body = String(item.body || '').toLocaleLowerCase('tr-TR');
  if (title === q) return 100;
  if (title.startsWith(q)) return 80;
  if (title.includes(q)) return 60;
  if (tags.includes(q)) return 45;
  if (body.includes(q)) return 20;
  return 0;
}

export function searchPromptLibrary(query: string): PromptRecord[] {
  const normalized = String(query || '').slice(0, MAX_QUERY);
  return loadItems()
    .map((item) => ({ item, score: score(item, normalized) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || Number(Boolean(b.item.favorite)) - Number(Boolean(a.item.favorite)) || String(b.item.updatedAt || '').localeCompare(String(a.item.updatedAt || '')))
    .slice(0, MAX_RESULTS)
    .map((entry) => entry.item);
}

function variableCount(item: PromptRecord): number {
  return root.HafizePromptLibrary?.extractVariables?.(item.body)?.length ?? 0;
}

function mount(documentRef: Document = root.document, rootRef: PaletteWindow = root): PaletteController | null {
  const input = documentRef?.getElementById(INPUT_ID) as HTMLTextAreaElement | null;
  if (!documentRef || !input || documentRef.getElementById(PALETTE_ID)) return null;

  const palette = make(documentRef, 'section', undefined, 'prompt-command-palette');
  palette.id = PALETTE_ID;
  palette.hidden = true;
  palette.setAttribute('role', 'dialog');
  palette.setAttribute('aria-modal', 'false');
  palette.setAttribute('aria-label', 'İstem seçici');
  const head = make(documentRef, 'div', undefined, 'prompt-command-palette-head');
  head.append(make(documentRef, 'strong', 'İstem seçici'), make(documentRef, 'span', '↑ ↓ seç · Enter ekle · Esc kapat', 'prompt-command-palette-hint'));
  const query = make(documentRef, 'input') as HTMLInputElement;
  query.type = 'search';
  query.maxLength = MAX_QUERY;
  query.placeholder = 'İstem ara…';
  query.setAttribute('aria-label', 'İstem seçicide ara');
  const list = make(documentRef, 'div', undefined, 'prompt-command-palette-list');
  list.setAttribute('role', 'listbox');
  const status = make(documentRef, 'div', '', 'prompt-command-palette-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  palette.append(head, query, list, status);
  documentRef.body.append(palette);

  let activeIndex = 0;
  let current: PromptRecord[] = [];
  let triggerStart = -1;
  let previousFocus: Element | null = null;

  const close = (): void => {
    palette.hidden = true;
    query.value = '';
    list.replaceChildren();
    current = [];
    activeIndex = 0;
    triggerStart = -1;
    if (previousFocus instanceof HTMLElement) previousFocus.focus();
    previousFocus = null;
  };

  const insert = (item: PromptRecord): void => {
    const text = input.value;
    const start = triggerStart >= 0 ? triggerStart : 0;
    const before = text.slice(0, start).replace(/\/prompt(?:\s+[^\n]*)?$/, '');
    if (variableCount(item) && rootRef.HafizePromptLibrarySmartFill?.open) {
      close();
      rootRef.HafizePromptLibrarySmartFill.open(item);
      return;
    }
    input.value = `${before}${item.body}`;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
    close();
    rootRef.dispatchEvent(new CustomEvent('hafize:prompt-command-inserted', { detail: { id: item.id, title: item.title } }));
  };

  const render = (): void => {
    current = searchPromptLibrary(query.value);
    list.replaceChildren();
    activeIndex = Math.min(activeIndex, Math.max(0, current.length - 1));
    status.textContent = current.length ? `${current.length} istem bulundu.` : (loadItems().length ? 'Eşleşen istem bulunamadı.' : 'Kütüphanede istem yok.');
    current.forEach((item, index) => {
      const option = make(documentRef, 'button', undefined, 'prompt-command-palette-item');
      option.type = 'button';
      option.dataset.promptId = item.id;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', String(index === activeIndex));
      option.append(
        make(documentRef, 'span', item.title, 'prompt-command-palette-name'),
        make(documentRef, 'span', `${item.favorite ? '★ ' : ''}${item.tags?.slice(0, 2).join(' · ') || 'etiketsiz'}${variableCount(item) ? ` · ${variableCount(item)} değişken` : ''}`, 'prompt-command-palette-meta')
      );
      option.addEventListener('click', () => insert(item));
      list.append(option);
    });
    list.children[activeIndex]?.scrollIntoView?.({ block: 'nearest' });
  };

  const open = (start: number): void => {
    previousFocus = documentRef.activeElement;
    triggerStart = Math.max(0, start);
    palette.hidden = false;
    query.value = '';
    activeIndex = 0;
    render();
    query.focus();
  };

  const move = (delta: number): void => {
    if (!current.length) return;
    activeIndex = (activeIndex + delta + current.length) % current.length;
    [...list.children].forEach((node, index) => node.setAttribute('aria-selected', String(index === activeIndex)));
    list.children[activeIndex]?.scrollIntoView?.({ block: 'nearest' });
  };

  const readTrigger = (): RegExpMatchArray | null => {
    const cursor = input.selectionStart ?? input.value.length;
    return input.value.slice(0, cursor).match(/(^|\s)\/prompt(?:\s+([^\n]*))?$/i);
  };

  const onInputKeydown = (event: KeyboardEvent): void => {
    const match = readTrigger();
    const cursor = input.selectionStart ?? input.value.length;
    if (!match) return;
    if (!event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey && ['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) {
      if (palette.hidden) open(cursor - match[0].length + (match[1] ? 1 : 0));
      if (event.key === 'ArrowDown') { event.preventDefault(); move(1); }
      if (event.key === 'ArrowUp') { event.preventDefault(); move(-1); }
      if (event.key === 'Enter' && current[activeIndex]) { event.preventDefault(); insert(current[activeIndex]); }
    } else if (palette.hidden && !event.ctrlKey && !event.metaKey && event.key === ' ') {
      open(cursor - match[0].length + (match[1] ? 1 : 0));
    }
  };

  const onInput = (): void => {
    const match = readTrigger();
    if (!match) { if (!palette.hidden) close(); return; }
    const cursor = input.selectionStart ?? input.value.length;
    if (palette.hidden) open(cursor - match[0].length + (match[1] ? 1 : 0));
    query.value = (match[2] || '').slice(0, MAX_QUERY);
    activeIndex = 0;
    render();
  };
  const onQueryInput = (): void => { activeIndex = 0; render(); };
  const onPaletteKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    else if (event.key === 'ArrowDown') { event.preventDefault(); move(1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); move(-1); }
    else if (event.key === 'Enter' && current[activeIndex]) { event.preventDefault(); insert(current[activeIndex]); }
  };
  const onShortcut = (event: KeyboardEvent): void => {
    if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.key.toLowerCase() !== 'o') return;
    event.preventDefault();
    if (palette.hidden) open(input.selectionStart ?? input.value.length); else close();
  };

  input.addEventListener('keydown', onInputKeydown);
  input.addEventListener('input', onInput);
  query.addEventListener('input', onQueryInput);
  palette.addEventListener('keydown', onPaletteKeydown);
  rootRef.addEventListener('keydown', onShortcut);

  return Object.freeze({
    mounted: true,
    open,
    close,
    search: searchPromptLibrary,
    destroy: () => {
      close();
      input.removeEventListener('keydown', onInputKeydown);
      input.removeEventListener('input', onInput);
      query.removeEventListener('input', onQueryInput);
      palette.removeEventListener('keydown', onPaletteKeydown);
      rootRef.removeEventListener('keydown', onShortcut);
      palette.remove();
    }
  });
}

root.PromptLibraryCommandPalette = Object.freeze({ mount, results: searchPromptLibrary });
const start = (): void => { if (root.document) mount(root.document, root); };
if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
