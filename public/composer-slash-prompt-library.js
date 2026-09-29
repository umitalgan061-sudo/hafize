(function installHafizeComposerPromptBridge(root) {
  'use strict';

  const KEY = 'prompt';
  const MAX_QUERY = 120;
  const MAX_BODY = 8000;
  const STORAGE_KEY = 'hafize.prompt-library.v1';

  function readItems() {
    try {
      const raw = root.localStorage?.getItem(STORAGE_KEY) || '[]';
      const value = JSON.parse(raw);
      return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object' && typeof item.id === 'string' && typeof item.body === 'string') : [];
    } catch {
      return [];
    }
  }

  function normalizeQuery(value) {
    return String(value ?? '').trim().toLocaleLowerCase('tr-TR').slice(0, MAX_QUERY);
  }

  function score(item, query) {
    if (!query) return 0;
    const q = normalizeQuery(query);
    const title = String(item.title || '').toLocaleLowerCase('tr-TR');
    const tags = Array.isArray(item.tags) ? item.tags.join(' ').toLocaleLowerCase('tr-TR') : '';
    const body = String(item.body || '').toLocaleLowerCase('tr-TR');
    if (title === q) return 1000;
    if (title.startsWith(q)) return 800;
    if (tags.includes(q)) return 600;
    if (title.includes(q)) return 500;
    if (body.includes(q)) return 300;
    return -1;
  }

  function findBest(query) {
    const normalized = normalizeQuery(query);
    if (!normalized) return null;
    return readItems()
      .map((item) => ({ item, score: score(item, normalized) }))
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => b.score - a.score || Number(b.item.favorite) - Number(a.item.favorite) || Number(b.item.useCount || 0) - Number(a.item.useCount || 0))[0]?.item || null;
  }

  function updateUseCount(item) {
    const api = root.HafizePromptLibrary;
    if (!api?.loadItems || !api?.saveItems) return;
    const items = api.loadItems(root.localStorage);
    const index = items.findIndex((candidate) => candidate.id === item.id);
    if (index < 0) return;
    items.splice(index, 1, api.normalizeItem({
      ...items[index],
      useCount: (items[index].useCount || 0) + 1,
      updatedAt: new Date().toISOString()
    }));
    api.saveItems(root.localStorage, items);
    root.dispatchEvent?.(new root.Event('hafize:prompt-library-changed'));
  }

  function install() {
    const api = root.HafizeComposerSlashCommands;
    if (!api || !root.HafizePromptLibrary) return null;
    api.unregisterCommand(KEY);
    const registered = api.registerRuntimeCommand({
      id: 'runtime-prompt-library',
      key: KEY,
      aliases: ['istem', 'library'],
      label: 'Kayıtlı istemi kullan',
      description: 'Prompt Library içinde ada, etikete veya metne göre ara.',
      template: (query) => {
        const item = findBest(query);
        if (!item) return query ? `Prompt Library'de “${String(query).slice(0, MAX_QUERY)}” ile eşleşen istem bulunamadı.` : 'Kullanmak istediğin kayıtlı istemin adını /prompt sonrasında yaz.';
        updateUseCount(item);
        root.dispatchEvent?.(new root.CustomEvent('hafize:composer-prompt-library-selected', { detail: { id: item.id, title: item.title } }));
        return String(item.body).slice(0, MAX_BODY);
      }
    });
    return registered;
  }

  root.HafizeComposerPromptBridge = Object.freeze({ normalizeQuery, score, findBest, updateUseCount, install });
  const start = () => install();
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(typeof globalThis !== 'undefined' ? globalThis : self);
