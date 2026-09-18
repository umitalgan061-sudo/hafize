(function installPromptLibraryFillHistory(root) {
  'use strict';
  const STORAGE_KEY = 'hafize.prompt-library.fill.history.v1';
  const MAX_ENTRIES = 24;
  const MAX_VALUES = 12;
  const MAX_VALUE = 1000;
  const MAX_TITLE = 72;

  const trim = (value, limit) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
  const normalizeValues = (values) => {
    const output = {};
    for (const [name, value] of Object.entries(values || {}).slice(0, MAX_VALUES)) {
      const key = trim(name, 32).replace(/[^a-zA-Z0-9_-]/g, '');
      if (!key) continue;
      output[key] = trim(value, MAX_VALUE);
    }
    return output;
  };
  const normalizeEntry = (entry) => {
    if (!entry || typeof entry !== 'object') return null;
    const promptId = trim(entry.promptId, 120);
    if (!promptId) return null;
    return Object.freeze({
      id: trim(entry.id, 100) || `h${Date.now()}${Math.random().toString(16).slice(2, 8)}`,
      promptId,
      title: trim(entry.title, MAX_TITLE) || 'İsimsiz istem',
      values: normalizeValues(entry.values),
      usedAt: trim(entry.usedAt, 40) || new Date().toISOString()
    });
  };
  const normalize = (value) => Array.isArray(value) ? value.map(normalizeEntry).filter(Boolean).slice(0, MAX_ENTRIES) : [];
  const read = () => {
    try { return normalize(JSON.parse(root.localStorage?.getItem(STORAGE_KEY) || '[]')); }
    catch { return []; }
  };
  const write = (entries) => {
    try { root.localStorage?.setItem(STORAGE_KEY, JSON.stringify(normalize(entries))); return true; }
    catch { return false; }
  };
  const byPrompt = (promptId) => read().filter((entry) => entry.promptId === promptId);
  const record = (entry) => {
    const normalized = normalizeEntry(entry);
    if (!normalized) return false;
    const entries = read().filter((candidate) => candidate.promptId !== normalized.promptId || JSON.stringify(candidate.values) !== JSON.stringify(normalized.values));
    entries.unshift(normalized);
    return write(entries);
  };
  const remove = (id) => write(read().filter((entry) => entry.id !== id));
  const clearPrompt = (promptId) => write(read().filter((entry) => entry.promptId !== promptId));
  const clear = () => write([]);

  const make = (tag, textValue, className) => {
    const node = root.document.createElement(tag);
    if (className) node.className = className;
    if (textValue !== undefined) node.textContent = textValue;
    return node;
  };
  const button = (label) => { const node = make('button', label, 'mini-btn'); node.type = 'button'; return node; };

  function renderList(dialog, item, onApply) {
    const existing = dialog.querySelector('.prompt-library-fill-history');
    existing?.remove();
    const entries = byPrompt(item.id);
    const section = make('section', undefined, 'prompt-library-fill-history');
    section.setAttribute('aria-labelledby', 'promptLibraryFillHistoryTitle');
    const head = make('div', undefined, 'prompt-library-fill-history-head');
    const title = make('strong', 'Son doldurmalar', 'prompt-library-fill-history-title');
    title.id = 'promptLibraryFillHistoryTitle';
    const clear = button('Geçmişi temizle');
    head.append(title, clear);
    const list = make('div', undefined, 'prompt-library-fill-history-list');
    list.setAttribute('role', 'list');
    if (!entries.length) list.append(make('div', 'Bu istem için henüz doldurma geçmişi yok.', 'prompt-library-fill-history-empty'));
    for (const entry of entries) {
      const row = make('div', undefined, 'prompt-library-fill-history-row');
      row.setAttribute('role', 'listitem');
      const summary = Object.entries(entry.values).map(([name, value]) => `${name}: ${trim(value, 32)}`).join(' · ') || 'Boş değerler';
      const label = make('span', summary, 'prompt-library-fill-history-summary');
      const apply = button('Uygula');
      apply.dataset.fillHistoryId = entry.id;
      row.append(label, apply);
      list.append(row);
      apply.addEventListener('click', () => onApply(entry));
    }
    clear.addEventListener('click', () => {
      if (!root.confirm?.('Bu istemin doldurma geçmişi temizlensin mi?')) return;
      clearPrompt(item.id);
      renderList(dialog, item, onApply);
    });
    section.append(head, list);
    dialog.querySelector('.prompt-library-fill-preview-label')?.after(section);
  }

  function connect(dialog, item, fillApi) {
    if (!dialog || !item || !fillApi) return;
    const applyEntry = (entry) => {
      dialog.querySelectorAll('.prompt-library-fill-field input[name]').forEach((input) => {
        if (Object.prototype.hasOwnProperty.call(entry.values || {}, input.name)) {
          input.value = trim(entry.values[input.name], MAX_VALUE);
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
    };
    renderList(dialog, item, applyEntry);
  }

  root.HafizePromptLibraryFillHistory = Object.freeze({ STORAGE_KEY, MAX_ENTRIES, MAX_VALUE, normalize, read, write, byPrompt, record, remove, clearPrompt, clear, connect });
})(typeof globalThis !== 'undefined' ? globalThis : self);
