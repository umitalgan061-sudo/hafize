(function installPromptSmartInsertSuggestions(root) {
  'use strict';
  const MAX_SUGGESTIONS = 5;
  const MAX_SCORE = 1000;
  const normalize = (value) => String(value ?? '').toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').trim();

  function variableMap(profile) {
    const map = Object.create(null);
    for (const [key, value] of Object.entries(profile?.values || {})) map[key] = String(value ?? '').slice(0, 1000);
    return map;
  }

  function score(item, profile) {
    if (!item || !profile) return 0;
    const itemVars = new Set((item.variables || []).map(normalize));
    const profileVars = Object.keys(profile.values || {}).map(normalize);
    let value = 0;
    for (const name of profileVars) if (itemVars.has(name)) value += 100;
    const title = normalize(item.title);
    const profileName = normalize(profile.name);
    if (profileName && title.includes(profileName)) value += 20;
    return Math.min(MAX_SCORE, value);
  }

  function rank(items, profile) {
    return items.map((item, index) => ({ item, score: score(item, profile), index }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, MAX_SUGGESTIONS)
      .map((entry) => entry.item);
  }

  function recommend(profile, items) {
    const library = Array.isArray(items) ? items : root.HafizePromptLibrary?.loadItems?.(root.localStorage) || [];
    return rank(library, profile);
  }

  function fillValues(item, profile) {
    if (!item) return Object.create(null);
    const values = variableMap(profile);
    const result = Object.create(null);
    for (const name of item.variables || []) result[name] = values[name] || '';
    return result;
  }

  function hasMissing(item, profile) {
    return (item?.variables || []).some((name) => !String(profile?.values?.[name] ?? '').trim());
  }

  function render(documentRef, host, profile, items, openItem) {
    if (!documentRef || !host || !profile) return;
    host.replaceChildren();
    const title = documentRef.createElement('div');
    title.className = 'prompt-smart-insert-suggestions-title';
    title.textContent = `${profile.name} için önerilen istemler`;
    host.append(title);
    const list = documentRef.createElement('div');
    list.className = 'prompt-smart-insert-suggestions-list';
    list.setAttribute('role', 'list');
    const suggestions = recommend(profile, items);
    if (!suggestions.length) {
      const empty = documentRef.createElement('div');
      empty.className = 'prompt-smart-insert-suggestions-empty';
      empty.textContent = 'Bu profil ile eşleşen değişkenli istem bulunamadı.';
      list.append(empty);
    } else suggestions.forEach((item) => {
      const row = documentRef.createElement('div');
      row.className = 'prompt-smart-insert-suggestion-row';
      row.setAttribute('role', 'listitem');
      const name = documentRef.createElement('span');
      name.className = 'prompt-smart-insert-suggestion-name'; name.textContent = item.title || 'İsimsiz istem';
      const status = documentRef.createElement('span');
      status.className = 'prompt-smart-insert-suggestion-status';
      status.textContent = hasMissing(item, profile) ? 'Eksik değer' : 'Hazır';
      const open = documentRef.createElement('button');
      open.type = 'button'; open.className = 'mini-btn'; open.textContent = 'Akıllı doldur';
      open.setAttribute('aria-label', `${item.title || 'İsimsiz istem'} için akıllı doldurmayı aç`);
      open.addEventListener('click', () => openItem?.(item));
      row.append(name, status, open); list.append(row);
    });
    host.append(list);
  }

  function mount() {
    const center = root.document?.getElementById?.('promptLibrarySmartInsertCenter');
    if (!center || root.document.getElementById('promptLibrarySmartInsertSuggestions')) return null;
    const section = root.document.createElement('section');
    section.id = 'promptLibrarySmartInsertSuggestions';
    section.className = 'prompt-smart-insert-suggestions';
    section.setAttribute('aria-labelledby', 'promptSmartInsertSuggestionsTitle');
    const heading = root.document.createElement('strong');
    heading.id = 'promptSmartInsertSuggestionsTitle'; heading.textContent = 'Profil önerileri';
    const host = root.document.createElement('div');
    host.className = 'prompt-smart-insert-suggestions-host';
    section.append(heading, host); center.append(section);
    const refresh = () => {
      const profiles = root.HafizePromptLibrarySmartInsertCenter?.loadProfiles?.() || [];
      const profile = profiles.find((item) => item.favorite) || profiles[0];
      render(root.document, host, profile, null, (item) => root.HafizePromptLibrarySmartInsert?.open?.(item));
    };
    root.addEventListener?.('hafize:prompt-library-variable-profiles-changed', refresh);
    const cleanup = () => root.removeEventListener?.('hafize:prompt-library-variable-profiles-changed', refresh);
    root.addEventListener?.('beforeunload', cleanup, { once: true });
    refresh();
    return Object.freeze({ render: refresh, destroy: () => { cleanup(); section.remove(); } });
  }

  root.HafizePromptLibrarySmartInsertSuggestions = Object.freeze({ MAX_SUGGESTIONS, normalize, variableMap, score, rank, recommend, fillValues, hasMissing, render, mount });
  const start = () => mount();
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})(typeof globalThis !== 'undefined' ? globalThis : self);
