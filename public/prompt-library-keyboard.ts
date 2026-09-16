interface PromptKeyboardRoot extends Window {
  readonly document: Document;
}

let installed = false;

export function installPromptLibraryKeyboard(root: PromptKeyboardRoot = globalThis as PromptKeyboardRoot): void {
  if (installed || !root.document) return;
  const card = root.document.querySelector<HTMLElement>('#promptLibraryCard');
  if (!card) return;
  installed = true;

  root.document.addEventListener('keydown', (event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey) || !event.shiftKey) return;
    const key = event.key.toLowerCase();
    if (key === 'p') {
      const search = root.document.querySelector<HTMLInputElement>('#promptLibrarySearch');
      if (!search) return;
      event.preventDefault();
      search.focus();
      search.select();
      return;
    }
    if (key === 'n') {
      const create = card.querySelector<HTMLButtonElement>('.prompt-library-actions .soft-btn');
      if (!create) return;
      event.preventDefault();
      create.click();
    }
  }, { passive: false });
}

const root = globalThis as PromptKeyboardRoot;
if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', () => installPromptLibraryKeyboard(root), { once: true });
else installPromptLibraryKeyboard(root);
