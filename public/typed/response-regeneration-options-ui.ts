import {
  normalizeRegenerationInstruction,
  presetById,
  REGENERATION_PRESETS
} from './response-regeneration-options.ts';

const DIALOG_ID = 'hafizeRegenerationOptionsDialog';

interface OptionsDialog {
  documentRef?: Document;
  trigger?: HTMLElement | null;
  onSelect: (instruction: string) => void;
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

export function closeRegenerationOptions(documentRef: Document = document): void {
  documentRef.getElementById(DIALOG_ID)?.remove();
}

export function openRegenerationOptions(options: OptionsDialog): void {
  const documentRef = options.documentRef ?? document;
  closeRegenerationOptions(documentRef);

  const dialog = make(documentRef, 'div', '', 'response-regeneration-options');
  dialog.id = DIALOG_ID;
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'hafizeRegenerationOptionsTitle');
  dialog.tabIndex = -1;

  const panel = make(documentRef, 'div', '', 'response-regeneration-options-panel');
  const head = make(documentRef, 'div', '', 'response-regeneration-options-head');
  const title = make(documentRef, 'h3', 'Yeniden üretme seçenekleri');
  title.id = 'hafizeRegenerationOptionsTitle';
  const close = make(documentRef, 'button', 'Kapat', 'message-action');
  close.type = 'button';
  close.setAttribute('aria-label', 'Yeniden üretme seçeneklerini kapat');
  head.append(title, close);

  const help = make(
    documentRef,
    'p',
    'Yeni cevabı hangi yönde değiştirmek istediğini seç. Bu yönerge sohbete ayrı bir mesaj olarak kaydedilmez.',
    'response-regeneration-options-help'
  );

  const presetList = make(documentRef, 'div', '', 'response-regeneration-preset-list');
  presetList.setAttribute('role', 'list');

  const choose = (instruction: string): void => {
    const clean = normalizeRegenerationInstruction(instruction);
    if (!clean) return;
    options.onSelect(clean);
    closeRegenerationOptions(documentRef);
    options.trigger?.focus?.();
  };

  for (const preset of REGENERATION_PRESETS) {
    const item = make(documentRef, 'div', '', 'response-regeneration-preset');
    item.setAttribute('role', 'listitem');
    const button = make(documentRef, 'button', preset.label, 'message-action');
    button.type = 'button';
    button.setAttribute('aria-label', preset.label + ' yönergesiyle yeniden üret');
    button.addEventListener('click', () => choose(preset.instruction));
    item.append(button);
    presetList.append(item);
  }

  const customLabel = make(documentRef, 'label', 'Özel yönerge', 'response-regeneration-custom-label');
  const custom = make(documentRef, 'textarea');
  custom.rows = 3;
  custom.maxLength = 600;
  custom.placeholder = 'Örn. Daha teknik yaz, kısa bir özet ekle, belirsizlikleri açıkça belirt…';
  custom.setAttribute('aria-label', 'Özel yeniden üretme yönergesi');

  const customAction = make(documentRef, 'button', 'Özel yönergeyle yeniden üret', 'message-action');
  customAction.type = 'button';
  customAction.addEventListener('click', () => choose(custom.value));

  const footer = make(documentRef, 'div', '', 'response-regeneration-options-footer');
  const cancel = make(documentRef, 'button', 'Vazgeç', 'message-action');
  cancel.type = 'button';
  cancel.addEventListener('click', () => {
    closeRegenerationOptions(documentRef);
    options.trigger?.focus?.();
  });
  footer.append(cancel);

  panel.append(head, help, presetList, customLabel, custom, customAction, footer);
  dialog.append(panel);
  (documentRef.body ?? documentRef.documentElement).append(dialog);

  close.addEventListener('click', () => {
    closeRegenerationOptions(documentRef);
    options.trigger?.focus?.();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      closeRegenerationOptions(documentRef);
      options.trigger?.focus?.();
    }
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeRegenerationOptions(documentRef);
      options.trigger?.focus?.();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusables = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), textarea')];
    if (!focusables.length) return;
    const index = focusables.indexOf(documentRef.activeElement as HTMLElement);
    if (event.shiftKey && index <= 0) {
      event.preventDefault();
      focusables.at(-1)?.focus();
    } else if (!event.shiftKey && index === focusables.length - 1) {
      event.preventDefault();
      focusables[0]?.focus();
    }
  });

  custom.addEventListener('input', () => {
    customAction.disabled = normalizeRegenerationInstruction(custom.value).length === 0;
  });
  customAction.disabled = true;
  close.focus();
}

export function presetLabel(id: unknown): string {
  return presetById(id)?.label ?? '';
}
