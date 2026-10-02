// @ts-nocheck
(function installHafizePromptSmartViewsBuilder(root) {
  'use strict';

  const CARD_ID = 'promptLibraryCard';
  const PANEL_ID = 'promptLibrarySmartViewBuilder';
  const MAX_TEXT = 120;
  const MAX_QUERY = 180;

  const text = (doc, value, className) => {
    const node = doc.createElement('span');
    if (className) node.className = className;
    node.textContent = String(value ?? '');
    return node;
  };

  const button = (doc, label) => {
    const node = doc.createElement('button');
    node.type = 'button';
    node.className = 'mini-btn prompt-smart-view-builder-action';
    node.textContent = label;
    return node;
  };

  const clean = (value, max) => String(value ?? '').replace(/\0/g, '').trim().slice(0, max);
  const lower = (value) => String(value ?? '').toLocaleLowerCase('tr-TR');

  function core(card) {
    return {
      favoriteOnly: card.querySelector('#promptLibraryFavoriteFilter')?.getAttribute('aria-pressed') === 'true',
      tag: card.querySelector('.prompt-library-filters select')?.value || 'all',
      sort: card.querySelector('.prompt-library-toolbar select')?.value || 'updated-desc'
    };
  }

  function tags() {
    const items = root.HafizePromptLibrary?.loadItems?.(root.localStorage) || [];
    const values = new Map();
    for (const item of items) for (const tag of Array.isArray(item.tags) ? item.tags : []) {
      const key = lower(tag);
      if (!values.has(key)) values.set(key, tag);
    }
    return [...values.values()].sort((a, b) => a.localeCompare(b, 'tr')).slice(0, 40);
  }

  function buildQuery(textValue, tagValue, favoriteValue, variableValue, minUse, maxUse) {
    const parts = [];
    const textPart = clean(textValue, MAX_TEXT);
    if (textPart) parts.push(textPart.includes(' ') ? '"' + textPart + '"' : textPart);
    if (tagValue && tagValue !== 'all') parts.push('tag:' + clean(tagValue, 24));
    if (favoriteValue === 'yes') parts.push('is:favorite');
    if (favoriteValue === 'no') parts.push('is:not-favorite');
    if (variableValue === 'yes') parts.push('has:variable');
    if (variableValue === 'no') parts.push('has:no-variable');
    if (Number(minUse) > 0) parts.push('used:>=' + Math.min(9999, Math.floor(Number(minUse))));
    if (Number(maxUse) < 9999) parts.push('used:<=' + Math.max(0, Math.floor(Number(maxUse))));
    return parts.join(' ').slice(0, MAX_QUERY);
  }

  function previewCount(view) {
    const items = root.HafizePromptLibrary?.loadItems?.(root.localStorage) || [];
    const smartViews = root.HafizePromptLibrarySmartViews;
    return smartViews ? smartViews.evaluate(items, view).length : 0;
  }

  function applyEphemeral(view, card) {
    const smartViews = root.HafizePromptLibrarySmartViews;
    if (!smartViews || !card) return false;
    smartViews.applyView(view, card);
    smartViews.saveState({ ...smartViews.loadState(root.localStorage), activeId: '' }, root.localStorage);
    const items = root.HafizePromptLibrary?.loadItems?.(root.localStorage) || [];
    const visible = new Set(smartViews.evaluate(items, view).map((item) => item.id));
    card.querySelectorAll('.prompt-item[data-prompt-id]').forEach((row) => {
      row.hidden = !visible.has(row.dataset.promptId);
    });
    return true;
  }

  function mount(documentRef = root.document, rootRef = root) {
    const card = documentRef?.getElementById?.(CARD_ID);
    if (!documentRef || !card || documentRef.getElementById(PANEL_ID)) return null;

    const section = documentRef.createElement('section');
    section.id = PANEL_ID;
    section.className = 'prompt-library-smart-view-builder';
    section.setAttribute('aria-labelledby', 'promptSmartViewBuilderTitle');

    const head = documentRef.createElement('div');
    head.className = 'prompt-smart-view-builder-head';
    const title = text(documentRef, 'Hızlı sorgu oluşturucu', 'prompt-smart-view-builder-title');
    title.id = 'promptSmartViewBuilderTitle';
    const count = text(documentRef, '0 kayıt', 'prompt-smart-view-builder-count');
    const collapse = button(documentRef, 'Gizle');
    collapse.setAttribute('aria-expanded', 'true');
    collapse.setAttribute('aria-controls', 'promptSmartViewBuilderBody');
    head.append(title, count, collapse);

    const body = documentRef.createElement('div');
    body.id = 'promptSmartViewBuilderBody';
    body.className = 'prompt-smart-view-builder-body';

    const freeText = documentRef.createElement('input');
    freeText.type = 'search';
    freeText.maxLength = MAX_TEXT;
    freeText.placeholder = 'Metin…';
    freeText.setAttribute('aria-label', 'Sorguda aranacak metin');

    const tag = documentRef.createElement('select');
    tag.setAttribute('aria-label', 'Sorgu etiketi');
    const tagAll = documentRef.createElement('option');
    tagAll.value = 'all';
    tagAll.textContent = 'Tüm etiketler';
    tag.append(tagAll);
    tags().forEach((value) => {
      const option = documentRef.createElement('option');
      option.value = value;
      option.textContent = value;
      tag.append(option);
    });

    const favorite = documentRef.createElement('select');
    favorite.setAttribute('aria-label', 'Favori filtresi');
    [['all', 'Favori filtresi yok'], ['yes', 'Yalnız favoriler'], ['no', 'Favori olmayanlar']].forEach(([value, label]) => {
      const option = documentRef.createElement('option');
      option.value = value;
      option.textContent = label;
      favorite.append(option);
    });

    const variable = documentRef.createElement('select');
    variable.setAttribute('aria-label', 'Değişken filtresi');
    [['all', 'Değişken filtresi yok'], ['yes', 'Değişkenli'], ['no', 'Değişkensiz']].forEach(([value, label]) => {
      const option = documentRef.createElement('option');
      option.value = value;
      option.textContent = label;
      variable.append(option);
    });

    const min = documentRef.createElement('input');
    min.type = 'number';
    min.min = '0';
    min.max = '9999';
    min.value = '0';
    min.inputMode = 'numeric';
    min.setAttribute('aria-label', 'En az kullanım');

    const max = documentRef.createElement('input');
    max.type = 'number';
    max.min = '0';
    max.max = '9999';
    max.value = '9999';
    max.inputMode = 'numeric';
    max.setAttribute('aria-label', 'En fazla kullanım');

    const description = documentRef.createElement('input');
    description.type = 'text';
    description.maxLength = 180;
    description.placeholder = 'Açıklama (isteğe bağlı)…';
    description.setAttribute('aria-label', 'Görünüm açıklaması');

    const controls = documentRef.createElement('div');
    controls.className = 'prompt-smart-view-builder-grid';
    controls.append(
      field(documentRef, 'Metin', freeText),
      field(documentRef, 'Etiket', tag),
      field(documentRef, 'Favori', favorite),
      field(documentRef, 'Değişken', variable),
      field(documentRef, 'Min. kullanım', min),
      field(documentRef, 'Maks. kullanım', max)
    );

    const queryPreview = text(documentRef, 'Sorgu: —', 'prompt-smart-view-builder-query');
    const help = text(documentRef, 'Sonuç anında hesaplanır; gerçek sohbet gönderimi yapılmaz.', 'prompt-smart-view-builder-help');

    const actions = documentRef.createElement('div');
    actions.className = 'prompt-smart-view-builder-actions';
    const apply = button(documentRef, 'Uygula');
    const save = button(documentRef, 'Görünüm olarak kaydet');
    const reset = button(documentRef, 'Temizle');
    actions.append(apply, save, reset);

    const status = text(documentRef, '', 'prompt-smart-view-builder-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    body.append(controls, description, queryPreview, help, actions, status);
    section.append(head, body);
    card.append(section);

    let collapsed = false;

    function field(doc, label, input) {
      const wrap = doc.createElement('label');
      wrap.className = 'prompt-smart-view-builder-field';
      wrap.append(text(doc, label, 'prompt-smart-view-builder-label'), input);
      return wrap;
    }

    function viewFromForm() {
      const minValue = Math.max(0, Math.min(9999, Number(min.value) || 0));
      const maxValue = Math.max(minValue, Math.min(9999, Number(max.value) || 9999));
      const current = core(card);
      return {
        name: '',
        description: clean(description.value, 180),
        query: buildQuery(freeText.value, tag.value, favorite.value, variable.value, minValue, maxValue),
        favoriteOnly: favorite.value === 'yes',
        tag: tag.value,
        sort: current.sort,
        minUse: minValue,
        maxUse: maxValue,
        hasVariables: variable.value === 'yes'
      };
    }

    function report(message) {
      status.textContent = clean(message, 160);
    }

    function refreshPreview() {
      const view = viewFromForm();
      count.textContent = previewCount(view) + ' kayıt';
      queryPreview.textContent = 'Sorgu: ' + (view.query || '—');
    }

    function clearForm() {
      freeText.value = '';
      tag.value = 'all';
      favorite.value = 'all';
      variable.value = 'all';
      min.value = '0';
      max.value = '9999';
      description.value = '';
      refreshPreview();
      freeText.focus();
    }

    [freeText, tag, favorite, variable, min, max].forEach((control) => {
      control.addEventListener('input', refreshPreview);
      control.addEventListener('change', refreshPreview);
    });

    description.addEventListener('input', () => {
      description.value = clean(description.value, 180);
    });

    apply.addEventListener('click', () => {
      const view = viewFromForm();
      if (applyEphemeral(view, card)) {
        report('Geçici akıllı görünüm uygulandı.');
        rootRef.dispatchEvent?.(new rootRef.CustomEvent('hafize:prompt-library-smart-view-applied', {
          detail: { id: '', name: 'Hızlı sorgu' }
        }));
      }
    });

    save.addEventListener('click', () => {
      const api = rootRef.HafizePromptLibrarySmartViews;
      if (!api) return report('Akıllı görünüm modülü bulunamadı.');
      const views = api.load(rootRef.localStorage);
      if (views.length >= api.MAX_VIEWS) return report('Akıllı görünüm sınırı dolu.');
      const base = viewFromForm();
      const requested = clean(description.value, 180) || 'Yeni akıllı görünüm';
      let name = requested;
      const taken = new Set(views.map((view) => lower(view.name)));
      let index = 2;
      while (taken.has(lower(name))) name = clean(requested + ' ' + index++, 72);
      const next = api.normalizeView({
        ...base,
        id: rootRef.crypto?.randomUUID?.() || String(Date.now()),
        name,
        description: clean(description.value, 180),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      if (!next) return report('Görünüm oluşturulamadı.');
      if (!api.save([next, ...views].slice(0, api.MAX_VIEWS), rootRef.localStorage)) return report('Görünüm kaydedilemedi.');
      const state = api.loadState(rootRef.localStorage);
      api.saveState({ ...state, activeId: next.id }, rootRef.localStorage);
      report('Akıllı görünüm kaydedildi.');
      if (typeof rootRef.StorageEvent === 'function') rootRef.dispatchEvent?.(new rootRef.StorageEvent('storage', {
        key: api.STATE_KEY,
        newValue: rootRef.localStorage?.getItem?.(api.STATE_KEY) || null,
        storageArea: rootRef.localStorage
      }));
    });

    reset.addEventListener('click', clearForm);

    collapse.addEventListener('click', () => {
      collapsed = !collapsed;
      body.hidden = collapsed;
      collapse.textContent = collapsed ? 'Göster' : 'Gizle';
      collapse.setAttribute('aria-expanded', String(!collapsed));
    });

    const keyHandler = (event) => {
      if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.key.toLowerCase() !== 'q') return;
      const target = event.target;
      if (target?.matches?.('input,textarea,select,[contenteditable="true"]')) return;
      event.preventDefault();
      freeText.focus();
      freeText.select();
    };
    documentRef.addEventListener('keydown', keyHandler);
    refreshPreview();

    return Object.freeze({
      mounted: true,
      refresh: refreshPreview,
      viewFromForm,
      buildQuery,
      destroy: () => documentRef.removeEventListener('keydown', keyHandler)
    });
  }

  root.HafizePromptLibrarySmartViewBuilder = Object.freeze({
    buildQuery,
    previewCount,
    mount
  });

  const start = () => mount(root.document, root);
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(typeof globalThis !== 'undefined' ? globalThis : self);
