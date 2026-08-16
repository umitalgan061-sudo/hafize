(function exposeHafizeConversationSearch(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeConversationSearch = api;
  api.mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeConversationSearch() {
  'use strict';

  const MAX_QUERY_CHARS = 120;
  const MAX_TITLE_CHARS = 512;
  const STYLE_ID = 'hafize-conversation-search-style';
  const CONTROL_ID = 'conversationSearchControl';
  const INPUT_ID = 'conversationSearchInput';
  const STATUS_ID = 'conversationSearchStatus';
  const STYLE_TEXT = `
.conversation-search{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;margin:8px 0 10px}
.conversation-search-input{width:100%;min-width:0;border:1px solid var(--line,#ddd);border-radius:10px;background:var(--surface,#fff);color:inherit;padding:8px 9px;font:inherit;font-size:12px}
.conversation-search-input:focus-visible,.conversation-search-clear:focus-visible{outline:2px solid var(--accent,#d97706);outline-offset:2px}
.conversation-search-clear{border:1px solid var(--line,#ddd);border-radius:10px;background:transparent;color:var(--muted,#777);padding:7px 9px;font:inherit;font-size:11px;cursor:pointer}
.conversation-search-clear:disabled{opacity:.45;cursor:default}
.conversation-search-status{grid-column:1/-1;min-height:15px;color:var(--muted,#777);font-size:10px;line-height:1.35}
`;

  function normalizeQuery(value) {
    if (typeof value !== 'string') return null;
    if (value.length > MAX_QUERY_CHARS) return null;
    return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR');
  }

  function normalizedTitle(row) {
    const button = row?.querySelector?.('.conversation-open');
    const raw = typeof button?.textContent === 'string' ? button.textContent : '';
    if (!raw || raw.length > MAX_TITLE_CHARS) return '';
    return raw.trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR');
  }

  function filterRows(rows, rawQuery) {
    const query = normalizeQuery(rawQuery);
    const list = Array.from(rows || []);
    if (query === null) {
      for (const row of list) row.hidden = false;
      return Object.freeze({ ok: false, total: list.length, visible: list.length, query: '' });
    }

    let visible = 0;
    for (const row of list) {
      const match = !query || normalizedTitle(row).includes(query);
      row.hidden = !match;
      if (match) visible += 1;
    }
    return Object.freeze({ ok: true, total: list.length, visible, query });
  }

  function installStyles(documentRef) {
    if (!documentRef?.head || documentRef.querySelector?.(`#${STYLE_ID}`)) return false;
    const style = documentRef.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLE_TEXT;
    documentRef.head.append(style);
    return true;
  }

  function createController({
    documentRef = globalThis.document,
    MutationObserverImpl = globalThis.MutationObserver
  } = {}) {
    if (!documentRef || typeof documentRef.querySelector !== 'function') {
      throw new Error('INVALID_CONVERSATION_SEARCH_DOCUMENT');
    }

    let observer = null;
    let control = null;
    let input = null;
    let clearButton = null;
    let status = null;
    let list = null;

    function rows() {
      return list?.querySelectorAll?.('.conversation-row') || [];
    }

    function updateStatus(result) {
      if (!status || !clearButton) return;
      clearButton.disabled = !input?.value;
      if (!result.ok) {
        status.textContent = 'Arama çok uzun; filtre uygulanmadı.';
        return;
      }
      if (!result.query) {
        status.textContent = result.total ? `${result.total} sohbet` : 'Henüz sohbet yok.';
        return;
      }
      status.textContent = result.visible
        ? `${result.visible} / ${result.total} sohbet eşleşti`
        : 'Eşleşen sohbet yok.';
    }

    function apply() {
      const result = filterRows(rows(), input?.value || '');
      updateStatus(result);
      return result;
    }

    function clear({ focus = true } = {}) {
      if (!input) return false;
      if (input.value) input.value = '';
      apply();
      if (focus) input.focus?.();
      return true;
    }

    function createControl(historyBlock) {
      const existing = documentRef.querySelector(`#${CONTROL_ID}`);
      if (existing) return existing;

      const wrapper = documentRef.createElement('div');
      wrapper.id = CONTROL_ID;
      wrapper.className = 'conversation-search';
      wrapper.setAttribute('role', 'search');

      const field = documentRef.createElement('input');
      field.id = INPUT_ID;
      field.className = 'conversation-search-input';
      field.type = 'search';
      field.maxLength = MAX_QUERY_CHARS;
      field.autocomplete = 'off';
      field.spellcheck = false;
      field.placeholder = 'Sohbet ara';
      field.setAttribute('aria-label', 'Son sohbetlerde başlığa göre ara');
      field.setAttribute('aria-controls', 'conversationList');

      const button = documentRef.createElement('button');
      button.type = 'button';
      button.className = 'conversation-search-clear';
      button.textContent = 'Temizle';
      button.setAttribute('aria-label', 'Sohbet aramasını temizle');

      const state = documentRef.createElement('small');
      state.id = STATUS_ID;
      state.className = 'conversation-search-status';
      state.setAttribute('role', 'status');
      state.setAttribute('aria-live', 'polite');

      wrapper.append(field, button, state);
      historyBlock.insertBefore(wrapper, list);
      return wrapper;
    }

    function mount() {
      const historyBlock = documentRef.querySelector('.history-block');
      list = documentRef.querySelector('#conversationList');
      if (!historyBlock || !list) return false;
      installStyles(documentRef);
      control = createControl(historyBlock);
      input = control.querySelector?.(`#${INPUT_ID}`);
      clearButton = control.querySelector?.('.conversation-search-clear');
      status = control.querySelector?.(`#${STATUS_ID}`);
      if (!input || !clearButton || !status) return false;

      input.addEventListener('input', apply);
      input.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || event.defaultPrevented) return;
        event.preventDefault();
        clear();
      });
      clearButton.addEventListener('click', () => clear());
      apply();

      if (typeof MutationObserverImpl === 'function') {
        observer = new MutationObserverImpl(() => apply());
        observer.observe(list, { childList: true, subtree: true });
      }
      return true;
    }

    function destroy() {
      observer?.disconnect?.();
      observer = null;
      control?.remove?.();
      control = null;
    }

    return Object.freeze({ mount, destroy, apply, clear });
  }

  function mount(options) {
    try {
      const controller = createController(options);
      return controller.mount() ? controller : null;
    } catch {
      return null;
    }
  }

  return Object.freeze({
    MAX_QUERY_CHARS,
    MAX_TITLE_CHARS,
    STYLE_ID,
    CONTROL_ID,
    INPUT_ID,
    STATUS_ID,
    normalizeQuery,
    normalizedTitle,
    filterRows,
    installStyles,
    createController,
    mount
  });
});
