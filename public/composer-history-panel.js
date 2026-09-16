(function installHafizeComposerHistoryPanel(root) {
  'use strict';
  const PANEL_ID = 'composerHistoryPanel';
  const TOGGLE_ID = 'composerHistoryToggle';
  const INPUT_ID = 'messageInput';
  const MAX_QUERY = 80;
  const MAX_RESULTS = 40;

  function core() { return root.HafizeComposerHistory; }
  function controller() { return root.HafizeComposerHistoryController; }
  function make(doc, tag, textValue, className) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (textValue !== undefined) node.textContent = String(textValue);
    return node;
  }
  function button(doc, label, className) {
    const node = make(doc, 'button', label, className || 'mini-btn');
    node.type = 'button';
    node.textContent = label;
    return node;
  }
  function normalize(value) { return core()?.normalize?.(value) || String(value ?? '').slice(0, 12000); }

  function boot() {
    const doc = root.document;
    const composer = /** @type {HTMLTextAreaElement | null} */ (doc?.getElementById?.(INPUT_ID) ?? null);
    const form = composer?.closest?.('form');
    if (!doc || !composer || !form || doc.getElementById(PANEL_ID)) return null;

    const toggle = button(doc, 'Geçmiş', 'composer-history-toggle');
    toggle.id = TOGGLE_ID;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', PANEL_ID);
    toggle.title = 'Yerel gönderim geçmişini aç';
    const actions = form.querySelector('.composer-tools') || form.querySelector('.composer-row');
    actions?.prepend(toggle);

    const panel = make(doc, 'section', undefined, 'composer-history-panel');
    panel.id = PANEL_ID;
    panel.hidden = true;
    panel.setAttribute('aria-labelledby', 'composerHistoryTitle');
    const head = make(doc, 'div', undefined, 'composer-history-head');
    const title = make(doc, 'strong', 'Gönderim geçmişi');
    title.id = 'composerHistoryTitle';
    const close = button(doc, 'Kapat');
    head.append(title, close);
    const search = make(doc, 'input');
    search.type = 'search';
    search.maxLength = MAX_QUERY;
    search.placeholder = 'Geçmişte ara…';
    search.setAttribute('aria-label', 'Gönderim geçmişinde ara');
    const meta = make(doc, 'div', '', 'composer-history-meta');
    const list = make(doc, 'div', undefined, 'composer-history-list');
    list.setAttribute('role', 'list');
    const footer = make(doc, 'div', undefined, 'composer-history-footer');
    const clear = button(doc, 'Geçmişi temizle');
    footer.append(clear);
    panel.append(head, search, meta, list, footer);
    form.after(panel);

    let query = '';
    let open = false;
    let timer = 0;

    const setOpen = (value) => {
      open = Boolean(value);
      panel.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      if (open) { search.focus(); search.select(); render(); }
    };
    const rows = () => {
      const values = controller()?.getItems?.() || core()?.load?.() || [];
      const q = query.toLocaleLowerCase('tr-TR');
      return values.filter((value) => !q || value.toLocaleLowerCase('tr-TR').includes(q)).slice(0, MAX_RESULTS);
    };
    const composerInsert = (value) => {
      composer.value = normalize(value);
      composer.dispatchEvent(new Event('input', { bubbles: true }));
      composer.focus();
      setOpen(false);
    };
    const render = () => {
      if (!panel || !doc.getElementById(PANEL_ID)) return;
      list.replaceChildren();
      const total = controller()?.getItems?.().length || 0;
      const visible = rows();
      meta.textContent = query ? `${visible.length}/${total} kayıt gösteriliyor` : `${total} kayıt`;
      if (!visible.length) { list.append(make(doc, 'div', total ? 'Arama sonucu yok.' : 'Henüz gönderilmiş bir mesaj yok.', 'composer-history-empty')); return; }
      visible.forEach((value, index) => {
        const row = make(doc, 'article', undefined, 'composer-history-row');
        row.setAttribute('role', 'listitem');
        const text = make(doc, 'div', value.replace(/\s+/g, ' ').slice(0, 180), 'composer-history-text');
        text.title = value;
        const use = button(doc, 'Kullan', 'mini-btn');
        use.addEventListener('click', () => composerInsert(value));
        const remove = button(doc, 'Sil', 'mini-btn');
        remove.setAttribute('aria-label', `Geçmiş kaydını sil: ${value.slice(0, 60)}`);
        remove.addEventListener('click', () => {
          const source = controller()?.getItems?.() || [];
          const next = source.filter((item) => item !== value);
          controller()?.clear?.();
          next.slice().reverse().forEach((item) => controller()?.add?.(item));
          render();
        });
        const rank = make(doc, 'span', `${index + 1}.`, 'composer-history-rank');
        row.append(rank, text, use, remove);
        list.append(row);
      });
    };
    const scheduleRender = () => { root.clearTimeout?.(timer); timer = root.setTimeout?.(render, 40) || 0; };
    const onHistoryChange = () => scheduleRender();
    const onSearch = () => { query = String(search.value || '').trim().slice(0, MAX_QUERY); render(); };
    const onKeydown = (event) => {
      if (event.key === 'Escape' && open) { event.preventDefault(); setOpen(false); toggle.focus(); }
      if (event.key.toLowerCase() === 'h' && (event.ctrlKey || event.metaKey) && event.shiftKey) { event.preventDefault(); setOpen(!open); }
    };
    const onToggle = () => setOpen(!open);
    const onClose = () => setOpen(false);
    const onClear = () => {
      if (!controller()?.getItems?.().length) return;
      if (!root.confirm?.('Yerel gönderim geçmişinin tamamı silinsin mi?')) return;
      controller()?.clear?.(); query = ''; search.value = ''; render();
    };

    toggle.addEventListener('click', onToggle);
    close.addEventListener('click', onClose);
    search.addEventListener('input', onSearch);
    clear.addEventListener('click', onClear);
    doc.addEventListener('keydown', onKeydown);
    root.addEventListener?.('storage', onHistoryChange);
    root.addEventListener?.('hafize:composer-history-changed', onHistoryChange);
    render();

    root.HafizeComposerHistoryPanel = Object.freeze({ open: () => setOpen(true), close: () => setOpen(false), refresh: render, getQuery: () => query, destroy: () => {
      root.clearTimeout?.(timer);
      toggle.removeEventListener('click', onToggle); close.removeEventListener('click', onClose); search.removeEventListener('input', onSearch); clear.removeEventListener('click', onClear);
      doc.removeEventListener('keydown', onKeydown); root.removeEventListener?.('storage', onHistoryChange); root.removeEventListener?.('hafize:composer-history-changed', onHistoryChange);
      toggle.remove(); panel.remove(); delete root.HafizeComposerHistoryPanel;
    }});
    return root.HafizeComposerHistoryPanel;
  }

  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
