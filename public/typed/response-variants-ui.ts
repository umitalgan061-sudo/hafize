import {
  listResponseVariants,
  selectResponseVariant,
  type ResponseVariant
} from './response-variants.ts';

const DIALOG_ID = 'hafizeResponseVariantsDialog';
const MAX_PREVIEW_LENGTH = 8000;

interface VariantDialogOptions {
  documentRef?: Document;
  trigger?: HTMLElement | null;
  current: string;
  alternates?: string[];
  onSelect: (current: string, alternates: string[]) => void;
}

function make<K extends keyof HTMLElementTagNameMap>(
  documentRef: Document,
  tag: K,
  value = '',
  className = ''
): HTMLElementTagNameMap[K] {
  const node = documentRef.createElement(tag);
  if (className) node.className = className;
  if (value) node.textContent = value;
  return node;
}

function closeDialog(documentRef: Document, trigger?: HTMLElement | null): void {
  documentRef.getElementById(DIALOG_ID)?.remove();
  trigger?.focus?.();
}

function renderVariantCard(
  documentRef: Document,
  variant: ResponseVariant,
  active: boolean,
  onChoose: () => void
): HTMLElement {
  const article = make(documentRef, 'article', '', 'response-variant-card');
  article.dataset.variantIndex = String(variant.index);
  if (active) article.dataset.active = 'true';

  const head = make(documentRef, 'div', '', 'response-variant-card-head');
  const label = make(
    documentRef,
    'strong',
    variant.kind === 'current' ? 'Mevcut yanıt' : 'Önceki yanıt'
  );
  const number = make(documentRef, 'span', String(variant.index + 1), 'response-variant-index');
  head.append(label, number);

  const preview = make(documentRef, 'pre', '', 'response-variant-preview');
  preview.setAttribute('aria-label', 'Yanıt varyantı önizlemesi');
  preview.textContent = variant.content.slice(0, MAX_PREVIEW_LENGTH);

  const action = make(documentRef, 'button', active ? 'Mevcut' : 'Bu yanıtı kullan', 'message-action');
  action.type = 'button';
  action.disabled = active;
  action.setAttribute(
    'aria-label',
    active ? 'Mevcut yanıt' : 'Bu yanıt varyantını mevcut yanıt yap'
  );
  action.addEventListener('click', onChoose);

  article.append(head, preview, action);
  return article;
}

export function openResponseVariantDialog(options: VariantDialogOptions): void {
  const documentRef = options.documentRef ?? document;
  const existing = documentRef.getElementById(DIALOG_ID);
  existing?.remove();

  const variants = listResponseVariants(options.current, options.alternates);
  if (variants.length <= 1) return;

  const dialog = make(documentRef, 'div', '', 'response-variant-dialog');
  dialog.id = DIALOG_ID;
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'hafizeResponseVariantsTitle');
  dialog.tabIndex = -1;

  const panel = make(documentRef, 'div', '', 'response-variant-panel');
  const head = make(documentRef, 'div', '', 'response-variant-panel-head');
  const title = make(documentRef, 'h3', 'Yanıt varyantları');
  title.id = 'hafizeResponseVariantsTitle';
  const close = make(documentRef, 'button', 'Kapat', 'message-action');
  close.type = 'button';
  close.setAttribute('aria-label', 'Yanıt varyantları panelini kapat');
  head.append(title, close);

  const help = make(
    documentRef,
    'p',
    'Önceki üretimleri incele ve istediğin yanıtı mevcut cevap olarak seç.',
    'response-variant-help'
  );

  const list = make(documentRef, 'div', '', 'response-variant-list');
  list.setAttribute('role', 'list');

  const render = (): void => {
    list.replaceChildren();
    const latest = listResponseVariants(options.current, options.alternates);
    latest.forEach((variant) => {
      const card = renderVariantCard(
        documentRef,
        variant,
        variant.index === 0,
        () => {
          const next = selectResponseVariant(options.current, options.alternates, variant.index);
          if (!next) return;
          options.onSelect(next.current, next.alternates);
          closeDialog(documentRef, options.trigger);
        }
      );
      card.setAttribute('role', 'listitem');
      list.append(card);
    });
  };

  close.addEventListener('click', () => closeDialog(documentRef, options.trigger));
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDialog(documentRef, options.trigger);
    }
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeDialog(documentRef, options.trigger);
  });

  const actionRow = make(documentRef, 'div', '', 'response-variant-dialog-actions');
  const closeFooter = make(documentRef, 'button', 'Vazgeç', 'message-action');
  closeFooter.type = 'button';
  closeFooter.addEventListener('click', () => closeDialog(documentRef, options.trigger));
  actionRow.append(closeFooter);

  panel.append(head, help, list, actionRow);
  dialog.append(panel);
  (documentRef.body ?? documentRef.documentElement).append(dialog);
  render();

  const focusables = (): HTMLElement[] =>
    [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), textarea, input, select')];

  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const nodes = focusables();
    if (!nodes.length) return;
    const index = nodes.indexOf(documentRef.activeElement as HTMLElement);
    if (event.shiftKey && index <= 0) {
      event.preventDefault();
      nodes.at(-1)?.focus();
    } else if (!event.shiftKey && index === nodes.length - 1) {
      event.preventDefault();
      nodes[0]?.focus();
    }
  });

  close.focus();
}

export function hasResponseVariants(current: string, alternates?: string[]): boolean {
  return listResponseVariants(current, alternates).length > 1;
}
