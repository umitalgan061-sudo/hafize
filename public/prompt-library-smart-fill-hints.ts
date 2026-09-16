interface HintsWindow extends Window {
  HafizePromptSmartFillHints?: Readonly<{
    mount: () => void;
    paint: (panel: HTMLElement) => void;
  }>;
}

const root = globalThis as HintsWindow;
const CARD_ID = 'promptLibraryCard';
const PANEL_ID = 'promptLibrarySmartFill';
const MAX_VALUE = 1000;
const MAX_PREVIEW = 8000;
let observer: MutationObserver | null = null;
let active = false;

function make<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  node.textContent = text;
  return node;
}

export function paintSmartFillHints(panel: HTMLElement): void {
  if (!panel || panel.hidden) return;
  panel.querySelectorAll<HTMLInputElement>('.prompt-smart-fill-field input').forEach((input) => {
    let hint = input.nextElementSibling as HTMLElement | null;
    if (!hint?.classList.contains('prompt-smart-fill-count')) {
      hint = make(panel.ownerDocument, 'small', '', 'prompt-smart-fill-count');
      input.after(hint);
    }
    const length = Math.min(MAX_VALUE, String(input.value || '').length);
    hint.textContent = `${length}/${MAX_VALUE}`;
    hint.setAttribute('aria-label', `${length} / ${MAX_VALUE} karakter`);
  });

  const preview = panel.querySelector<HTMLElement>('.prompt-smart-fill-preview');
  if (!preview) return;
  let count = panel.querySelector<HTMLElement>('.prompt-smart-fill-preview-count');
  if (!count) {
    count = make(panel.ownerDocument, 'small', '', 'prompt-smart-fill-preview-count');
    preview.after(count);
  }
  const length = Math.min(MAX_PREVIEW, String(preview.textContent || '').length);
  count.textContent = `${length}/${MAX_PREVIEW} karakter`;
}

function boot(): void {
  if (active || !root.document) return;
  const card = root.document.getElementById(CARD_ID);
  const panel = root.document.getElementById(PANEL_ID);
  if (!card || !panel) return;
  active = true;
  const refresh = () => root.requestAnimationFrame?.(() => paintSmartFillHints(panel));
  observer = typeof MutationObserver === 'function' ? new MutationObserver(refresh) : null;
  observer?.observe(panel, { childList: true, subtree: true, characterData: true, attributes: true });
  panel.addEventListener('input', refresh);
  root.addEventListener('beforeunload', () => {
    observer?.disconnect();
    observer = null;
    panel.removeEventListener('input', refresh);
  }, { once: true });
  paintSmartFillHints(panel);
}

root.HafizePromptSmartFillHints = Object.freeze({ mount: boot, paint: paintSmartFillHints });
if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
