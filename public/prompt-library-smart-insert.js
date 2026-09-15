(function installPromptSmartInsert(root) {
  'use strict';
  const CARD_ID = 'promptLibraryCard';
  const PANEL_ID = 'promptSmartInsertPanel';
  const MAX_VARS = 12;
  const MAX_VALUE = 1000;
  const MAX_PREVIEW = 8000;
  let installed = false;
  const api = () => root.HafizePromptLibrary;
  const clean = (value) => String(value ?? '').slice(0, MAX_VALUE);
  const button = (doc, label, action) => {
    const node = doc.createElement('button'); node.type = 'button'; node.className = 'soft-btn prompt-smart-action';
    node.textContent = label; node.dataset.smartAction = action; return node;
  };
  function variablesFor(item) { return [...new Set(api()?.extractVariables?.(item?.body || '') || [])].slice(0, MAX_VARS); }
  function destroyPanel(doc) { doc.getElementById(PANEL_ID)?.remove(); }
  function mountPanel(item) {
    const doc = root.document; const card = doc?.getElementById(CARD_ID); if (!doc || !card || !item) return;
    destroyPanel(doc); const names = variablesFor(item);
    const panel = doc.createElement('section'); panel.id = PANEL_ID; panel.className = 'prompt-smart-panel';
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'false'); panel.setAttribute('aria-labelledby', 'promptSmartInsertTitle');
    const head = doc.createElement('div'); head.className = 'prompt-smart-head';
    const title = doc.createElement('strong'); title.id = 'promptSmartInsertTitle'; title.textContent = 'İstemi doldur';
    const close = button(doc, 'Kapat', 'close'); head.append(title, close);
    const intro = doc.createElement('p'); intro.className = 'prompt-smart-intro';
    intro.textContent = names.length ? `${names.length} değişken için değer gir.` : 'Bu istemde değişken bulunmuyor.';
    const fields = doc.createElement('div'); fields.className = 'prompt-smart-fields'; const values = new Map();
    for (const name of names) {
      const wrap = doc.createElement('label'); wrap.className = 'prompt-smart-label';
      const caption = doc.createElement('span'); caption.textContent = `{{${name}}}`;
      const input = doc.createElement('input'); input.type = 'text'; input.maxLength = MAX_VALUE; input.autocomplete = 'off';
      input.dataset.smartVariable = name; input.setAttribute('aria-label', `${name} değişkeni`); wrap.append(caption, input); fields.append(wrap); values.set(name, input);
    }
    const previewTitle = doc.createElement('div'); previewTitle.className = 'prompt-smart-subtitle'; previewTitle.textContent = 'Önizleme';
    const preview = doc.createElement('pre'); preview.className = 'prompt-smart-preview'; preview.setAttribute('aria-live', 'polite');
    const actions = doc.createElement('div'); actions.className = 'prompt-smart-actions';
    const insert = button(doc, 'Composer’a ekle', 'insert'); const clear = button(doc, 'Alanları temizle', 'clear'); actions.append(insert, clear);
    panel.append(head, intro, fields, previewTitle, preview, actions); card.append(panel);
    const getValues = () => Object.fromEntries([...values].map(([key, node]) => [key, clean(node.value)]));
    const renderPreview = () => { const source = String(item.body || ''); const resolved = api()?.replaceVariables?.(source, getValues()) || source; preview.textContent = resolved.slice(0, MAX_PREVIEW); };
    values.forEach((input) => input.addEventListener('input', renderPreview)); renderPreview();
    const closePanel = () => destroyPanel(doc); close.addEventListener('click', closePanel);
    clear.addEventListener('click', () => { values.forEach((input) => { input.value = ''; }); renderPreview(); values.values().next().value?.focus?.(); });
    insert.addEventListener('click', () => {
      const composer = doc.getElementById('messageInput'); if (!composer) return;
      const filled = api()?.replaceVariables?.(String(item.body || ''), getValues()) || String(item.body || '');
      composer.value = filled.slice(0, MAX_PREVIEW); composer.dispatchEvent(new Event('input', { bubbles: true })); composer.focus(); closePanel();
    });
    panel.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.preventDefault(); closePanel(); } });
    (values.values().next().value || close).focus();
  }
  function onClick(event) {
    const target = event.target?.closest?.('[data-smart-fill]'); if (!target) return;
    const id = target.closest('.prompt-item')?.dataset.promptId; const items = api()?.loadItems?.(root.localStorage) || [];
    const item = items.find((candidate) => candidate.id === id); if (item) mountPanel(item);
  }
  function install() {
    if (installed || !root.document || !api()) return; const card = root.document.getElementById(CARD_ID); if (!card) return;
    installed = true; card.addEventListener('click', onClick);
    const observe = () => root.document.querySelectorAll('.prompt-item-actions').forEach((actions) => {
      if (actions.querySelector('[data-smart-fill]')) return;
      const node = button(root.document, 'Akıllı doldur', 'fill'); node.dataset.smartFill = 'true'; actions.append(node);
    });
    const observer = typeof MutationObserver === 'function' ? new MutationObserver(observe) : null; observer?.observe(card, { childList: true, subtree: true }); observe();
    root.addEventListener('beforeunload', () => observer?.disconnect?.(), { once: true });
  }
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})(typeof globalThis !== 'undefined' ? globalThis : self);
