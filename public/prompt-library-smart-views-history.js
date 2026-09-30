(function installHafizePromptSmartViewsHistory(root) {
  'use strict';

  const CARD_ID = 'promptLibraryCard';
  const PANEL_ID = 'promptLibrarySmartViewHistory';
  const VIEW_KEY = 'hafize.prompt-library.smart-views.v1';
  const HISTORY_KEY = 'hafize.prompt-library.smart-views-history.v1';
  const MAX_ITEMS = 20;
  const MAX_NAME = 72;
  const MAX_QUERY = 80;

  const text = (doc, value, className) => {
    const node = doc.createElement('span');
    if (className) node.className = className;
    node.textContent = String(value ?? '');
    return node;
  };

  const button = (doc, label) => {
    const node = doc.createElement('button');
    node.type = 'button';
    node.className = 'mini-btn prompt-smart-view-history-action';
    node.textContent = label;
    return node;
  };

  const clean = (value, max) => String(value ?? '').replace(/\0/g, '').trim().slice(0, max);
  const lower = (value) => String(value ?? '').toLocaleLowerCase('tr-TR');

  function normalizeEntry(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const viewId = clean(raw.viewId, 120);
    const name = clean(raw.name, MAX_NAME);
    if (!viewId || !name) return null;
    const count = Number(raw.count);
    return Object.freeze({
      id: clean(raw.id, 120) || String(Date.now()) + '-' + Math.random().toString(16).slice(2),
      viewId,
      name,
      count: Number.isFinite(count) && count > 0 ? Math.min(9999, Math.floor(count)) : 1,
      appliedAt: clean(raw.appliedAt, 40) || new Date().toISOString()
    });
  }

  function normalizeHistory(value) {
    if (!Array.isArray(value)) return [];
    const result = [];
    const ids = new Set();
    for (const raw of value.slice(0, MAX_ITEMS * 2)) {
      const item = normalizeEntry(raw);
      if (!item || ids.has(item.id)) continue;
      ids.add(item.id);
      result.push(item);
      if (result.length >= MAX_ITEMS) break;
    }
    return result;
  }

  function load(storage = root.localStorage) {
    try {
      return normalizeHistory(JSON.parse(storage?.getItem?.(HISTORY_KEY) || '[]'));
    } catch {
      return [];
    }
  }

  function save(history, storage = root.localStorage) {
    try {
      storage?.setItem?.(HISTORY_KEY, JSON.stringify(normalizeHistory(history)));
      root.dispatchEvent?.(new root.CustomEvent('hafize:prompt-library-smart-view-history-changed'));
      return true;
    } catch {
      return false;
    }
  }

  function record(view, storage = root.localStorage) {
    if (!view?.id || !view?.name) return false;
    const current = load(storage);
    const first = current[0];
    if (first?.viewId === view.id) {
      const updated = normalizeEntry({
        ...first,
        name: view.name,
        count: first.count + 1,
        appliedAt: new Date().toISOString()
      });
      return save([updated, ...current.slice(1)], storage);
    }
    return save([normalizeEntry({
      viewId: view.id,
      name: view.name,
      count: 1,
      appliedAt: new Date().toISOString()
    }), ...current].slice(0, MAX_ITEMS), storage);
  }

  function clear(storage = root.localStorage) {
    return save([], storage);
  }

  function remove(viewId, storage = root.localStorage) {
    return save(load(storage).filter((entry) => entry.viewId !== viewId), storage);
  }

  function findView(viewId) {
    return root.HafizePromptLibrarySmartViews?.load?.(root.localStorage)?.find?.((view) => view.id === viewId) || null;
  }

  function applyFromHistory(entry, card) {
    const view = findView(entry.viewId);
    const smartViews = root.HafizePromptLibrarySmartViews;
    if (!view || !smartViews || !card) return false;
    smartViews.applyView(view, card);
    const state = smartViews.loadState(root.localStorage);
    smartViews.saveState({ ...state, activeId: view.id }, root.localStorage);
    const items = root.HafizePromptLibrary?.loadItems?.(root.localStorage) || [];
    const matched = new Set(smartViews.evaluate(items, view).map((item) => item.id));
    card.querySelectorAll('.prompt-item[data-prompt-id]').forEach((row) => {
      row.hidden = !matched.has(row.dataset.promptId);
    });
    try {
      if (typeof root.StorageEvent === 'function') {
        root.dispatchEvent(new root.StorageEvent('storage', {
          key: smartViews.STATE_KEY,
          newValue: root.localStorage?.getItem?.(smartViews.STATE_KEY) || null,
          storageArea: root.localStorage
        }));
      }
    } catch {}
    record(view);
    return true;
  }

  function mount(documentRef = root.document, rootRef = root) {
    const card = documentRef?.getElementById?.(CARD_ID);
    if (!documentRef || !card || documentRef.getElementById(PANEL_ID)) return null;

    const section = documentRef.createElement('section');
    section.id = PANEL_ID;
    section.className = 'prompt-library-smart-view-history';
    section.setAttribute('aria-labelledby', 'promptSmartViewHistoryTitle');

    const heading = documentRef.createElement('div');
    heading.className = 'prompt-smart-view-history-head';
    const title = text(documentRef, 'Son kullanılan görünümler', 'prompt-smart-view-history-title');
    title.id = 'promptSmartViewHistoryTitle';
    const count = text(documentRef, '0', 'prompt-smart-view-history-count');
    const collapse = button(documentRef, 'Gizle');
    collapse.setAttribute('aria-expanded', 'true');
    collapse.setAttribute('aria-controls', 'promptSmartViewHistoryBody');
    heading.append(title, count, collapse);

    const body = documentRef.createElement('div');
    body.id = 'promptSmartViewHistoryBody';
    body.className = 'prompt-smart-view-history-body';

    const toolbar = documentRef.createElement('div');
    toolbar.className = 'prompt-smart-view-history-toolbar';
    const search = documentRef.createElement('input');
    search.type = 'search';
    search.maxLength = MAX_QUERY;
    search.placeholder = 'Geçmişte ara…';
    search.setAttribute('aria-label', 'Görünüm geçmişinde ara');
    const clearButton = button(documentRef, 'Geçmişi temizle');
    toolbar.append(search, clearButton);

    const list = documentRef.createElement('div');
    list.className = 'prompt-smart-view-history-list';
    list.setAttribute('role', 'list');
    const status = text(documentRef, '', 'prompt-smart-view-history-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    body.append(toolbar, list, status);
    section.append(heading, body);
    card.append(section);

    let collapsed = false;

    function report(message) {
      status.textContent = clean(message, 160);
    }

    function render() {
      const entries = load(rootRef.localStorage);
      const filtered = entries.filter((entry) => lower(entry.name).includes(lower(search.value)));
      count.textContent = filtered.length + '/' + entries.length;
      list.replaceChildren();
      if (!filtered.length) {
        list.append(text(documentRef, entries.length ? 'Eşleşen kullanım kaydı yok.' : 'Henüz görünüm kullanılmadı.', 'prompt-smart-view-history-empty'));
        return;
      }
      for (const entry of filtered) {
        const row = documentRef.createElement('article');
        row.className = 'prompt-smart-view-history-row';
        row.dataset.smartViewHistoryId = entry.viewId;
        row.setAttribute('role', 'listitem');
        const info = documentRef.createElement('div');
        info.className = 'prompt-smart-view-history-info';
        info.append(text(documentRef, entry.name, 'prompt-smart-view-history-name'));
        const date = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.appliedAt));
        info.append(text(documentRef, entry.count + ' kullanım · ' + date, 'prompt-smart-view-history-meta'));
        const actions = documentRef.createElement('div');
        actions.className = 'prompt-smart-view-history-actions';
        const apply = button(documentRef, 'Uygula');
        const removeButton = button(documentRef, 'Kaldır');
        actions.append(apply, removeButton);
        row.append(info, actions);
        list.append(row);

        apply.addEventListener('click', () => {
          if (!applyFromHistory(entry, card)) return report('Bu görünüm artık mevcut değil.');
          report('Görünüm yeniden uygulandı.');
          render();
        });
        removeButton.addEventListener('click', () => {
          remove(entry.viewId, rootRef.localStorage);
          report('Geçmiş kaydı kaldırıldı.');
          render();
        });
      }
    }

    search.addEventListener('input', render);
    clearButton.addEventListener('click', () => {
      if (!rootRef.confirm?.('Akıllı görünüm kullanım geçmişi temizlensin mi?')) return;
      clear(rootRef.localStorage);
      report('Görünüm geçmişi temizlendi.');
      render();
    });

    const onApplied = (event) => {
      const id = clean(event.detail?.id, 120);
      const view = root.HafizePromptLibrarySmartViews?.load?.(rootRef.localStorage)?.find?.((candidate) => candidate.id === id);
      if (view) record(view, rootRef.localStorage);
    };
    const onHistoryChange = render;
    rootRef.addEventListener?.('hafize:prompt-library-smart-view-applied', onApplied);
    rootRef.addEventListener?.('hafize:prompt-library-smart-view-history-changed', onHistoryChange);

    collapse.addEventListener('click', () => {
      collapsed = !collapsed;
      body.hidden = collapsed;
      collapse.textContent = collapsed ? 'Göster' : 'Gizle';
      collapse.setAttribute('aria-expanded', String(!collapsed));
    });

    render();

    return Object.freeze({
      mounted: true,
      refresh: render,
      load,
      record,
      clear,
      remove,
      destroy: () => {
        rootRef.removeEventListener?.('hafize:prompt-library-smart-view-applied', onApplied);
        rootRef.removeEventListener?.('hafize:prompt-library-smart-view-history-changed', onHistoryChange);
        section.remove();
      }
    });
  }

  root.HafizePromptLibrarySmartViewsHistory = Object.freeze({
    STORAGE_KEY: HISTORY_KEY,
    MAX_ITEMS,
    normalizeEntry,
    normalizeHistory,
    load,
    save,
    record,
    clear,
    remove,
    applyFromHistory,
    mount
  });

  const start = () => mount(root.document, root);
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(typeof globalThis !== 'undefined' ? globalThis : self);
