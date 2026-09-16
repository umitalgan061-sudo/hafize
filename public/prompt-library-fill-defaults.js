(function installPromptLibraryFillDefaults(root) {
  'use strict';
  const DIALOG_ID = 'promptLibraryFillDialog';
  const MARKER = 'data-hafize-fill-defaults';
  const MAX_VALUE = 1000;

  const infer = (name) => {
    const key = String(name || '').toLocaleLowerCase('tr-TR');
    const dictionary = {
      dil: 'Türkçe', language: 'Türkçe', ton: 'profesyonel', format: 'madde işaretleri', uzunluk: 'kısa', length: 'kısa', audience: 'genel okuyucu', hedef_kitle: 'genel okuyucu', konu: ''
    };
    return dictionary[key] ?? '';
  };
  const make = (tag, textValue, className) => { const node = root.document.createElement(tag); if (className) node.className = className; if (textValue !== undefined) node.textContent = textValue; return node; };
  const button = (label) => { const node = make('button', label, 'mini-btn'); node.type = 'button'; return node; };
  const bind = (dialog) => {
    if (!dialog || dialog.hasAttribute(MARKER)) return;
    const fields = [...dialog.querySelectorAll('.prompt-library-fill-field input[name]')];
    if (!fields.length) return;
    dialog.setAttribute(MARKER, 'true');
    const tools = make('div', undefined, 'prompt-library-fill-default-tools');
    const explain = make('span', 'Güvenli varsayılanlar', 'prompt-library-fill-default-label');
    const apply = button('Varsayılanları uygula');
    tools.append(explain, apply);
    dialog.querySelector('.prompt-library-fill-fields')?.before(tools);
    apply.addEventListener('click', () => {
      fields.forEach((input) => { const value = infer(input.name).slice(0, MAX_VALUE); if (!value || input.value) return; input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); });
    });
  };
  const boot = () => {
    if (!root.document?.body) return;
    const observer = new MutationObserver(() => bind(root.document.getElementById(DIALOG_ID)));
    observer.observe(root.document.body, { childList: true, subtree: true });
    root.addEventListener?.('beforeunload', () => observer.disconnect(), { once: true });
    bind(root.document.getElementById(DIALOG_ID));
  };
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
  root.HafizePromptLibraryFillDefaults = Object.freeze({ infer, bind });
})(typeof globalThis !== 'undefined' ? globalThis : self);
