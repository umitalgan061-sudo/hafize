interface PromptLibraryCompatOptions { readonly document?: Document; readonly root?: Window; }
export interface PromptLibraryDomContract { readonly card: HTMLElement; readonly search: HTMLInputElement | null; readonly createButton: HTMLButtonElement | null; readonly ready: boolean; }

const CARD_ID = 'promptLibraryCard';
const SEARCH_ID = 'promptLibrarySearch';
const CREATE_SELECTOR = '.prompt-library-actions .soft-btn';
const READY_EVENT = 'hafize:prompt-library-ready';

function ensureId<T extends HTMLElement>(node: T | null, id: string): T | null {
  if (!node) return null;
  if (!node.id) node.id = id;
  return node;
}

export function resolvePromptLibraryDom(options: PromptLibraryCompatOptions = {}): PromptLibraryDomContract | null {
  const documentRef = options.document ?? document;
  const card = documentRef.getElementById(CARD_ID);
  if (!(card instanceof HTMLElement)) return null;
  const search = ensureId(card.querySelector<HTMLInputElement>('input[type="search"]'), SEARCH_ID);
  const createButton = card.querySelector<HTMLButtonElement>(CREATE_SELECTOR);
  return Object.freeze({ card, search, createButton, ready: Boolean(search && createButton) });
}

export function installPromptLibraryDomContract(options: PromptLibraryCompatOptions = {}): PromptLibraryDomContract | null {
  const root = options.root ?? window;
  const contract = resolvePromptLibraryDom(options);
  if (!contract) return null;
  contract.card.dataset.promptLibraryDomContract = 'v1';
  if (contract.ready) root.document.dispatchEvent(new CustomEvent(READY_EVENT, { detail: { version: 1 } }));
  return contract;
}

export function focusPromptSearch(documentRef: Document = document): boolean {
  const search = documentRef.getElementById(SEARCH_ID) as HTMLInputElement | null;
  if (!search) return false;
  search.focus(); search.select(); return true;
}

export function openPromptCreator(documentRef: Document = document): boolean {
  const contract = resolvePromptLibraryDom({ document: documentRef });
  if (!contract?.createButton) return false;
  contract.createButton.click(); return true;
}

const boot = (): void => { void installPromptLibraryDomContract(); };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
