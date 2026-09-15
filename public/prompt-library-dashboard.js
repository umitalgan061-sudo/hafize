(function installHafizePromptDashboard(root) {
  'use strict';

  const CARD_ID = 'promptLibraryCard';
  const PANEL_ID = 'promptLibraryDashboard';
  const PROMPT_KEY = 'hafize.prompt-library.v1';
  const COLLECTION_KEY = 'hafize.prompt-library.collections.v1';
  const WORKSPACE_KEY = 'hafize.prompt-library.workspaces.v1';
  const REVISION_KEY = 'hafize.prompt-library.revisions.v1';
  const MAX_TOP = 5;

  function read(key, fallback) {
    try { const value = JSON.parse(root.localStorage?.getItem(key) || 'null'); return value ?? fallback; } catch { return fallback; }
  }
  function prompts() { const value = read(PROMPT_KEY, []); return Array.isArray(value) ? value : []; }
  function summary() {
    const items = prompts().filter((item) => item && typeof item.id === 'string');
    const totalUses = items.reduce((sum, item) => { const use = Number(item.useCount); return sum + (Number.isFinite(use) && use > 0 ? Math.floor(use) : 0); }, 0);
    const used = items.filter((item) => Number(item.useCount) > 0);
    const favorites = items.filter((item) => item.favorite === true);
    const tags = new Map();
    for (const item of items) for (const tag of Array.isArray(item.tags) ? item.tags : []) tags.set(String(tag), (tags.get(String(tag)) || 0) + 1);
    const topTags = [...tags.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'tr')).slice(0, MAX_TOP);
    const top = items.slice().sort((a, b) => Number(b.useCount) - Number(a.useCount)).slice(0, MAX_TOP);
    return { count: items.length, usedCount: used.length, totalUses, favorites: favorites.length, collections: Array.isArray(read(COLLECTION_KEY, {})?.collections) ? read(COLLECTION_KEY, {}).collections.length : 0, workspaces: Array.isArray(read(WORKSPACE_KEY, {})?.workspaces) ? read(WORKSPACE_KEY, {}).workspaces.length : 0, revisions: Array.isArray(read(REVISION_KEY, [])) ? read(REVISION_KEY, []).length : 0, topTags, top };
  }
  function button(doc, text) { const node = doc.createElement('button'); node.type = 'button'; node.className = 'mini-btn prompt-dashboard-toggle'; node.textContent = text; return node; }
  function inject() {
    const card = root.document?.getElementById?.(CARD_ID); if (!card || root.document.getElementById(PANEL_ID)) return;
    const section = root.document.createElement('section'); section.id = PANEL_ID; section.className = 'prompt-library-dashboard'; section.setAttribute('aria-labelledby', 'promptDashboardTitle');
    const head = root.document.createElement('div'); head.className = 'prompt-dashboard-head'; const title = root.document.createElement('strong'); title.id = 'promptDashboardTitle'; title.textContent = 'Çalışma alanı özeti'; const toggle = button(root.document, 'Gizle'); toggle.setAttribute('aria-expanded', 'true'); head.append(title, toggle);
    const body = root.document.createElement('div'); body.className = 'prompt-dashboard-body'; section.append(head, body); card.append(section);
    let hidden = false;
    toggle.addEventListener('click', () => { hidden = !hidden; body.hidden = hidden; toggle.textContent = hidden ? 'Göster' : 'Gizle'; toggle.setAttribute('aria-expanded', String(!hidden)); });
    function render() {
      body.replaceChildren(); const data = summary(); const stats = root.document.createElement('div'); stats.className = 'prompt-dashboard-stats';
      for (const [label, value] of [['İstem', data.count], ['Kullanılan', data.usedCount], ['Toplam kullanım', data.totalUses], ['Favori', data.favorites], ['Revizyon', data.revisions]]) { const item = root.document.createElement('div'); item.className = 'prompt-dashboard-stat'; const number = root.document.createElement('strong'); number.textContent = String(value); const caption = root.document.createElement('span'); caption.textContent = label; item.append(number, caption); stats.append(item); }
      body.append(stats);
      const title = root.document.createElement('strong'); title.textContent = 'En çok kullanılan'; body.append(title);
      const list = root.document.createElement('div'); list.className = 'prompt-dashboard-list'; list.setAttribute('role', 'list');
      if (!data.top.length) { const empty = root.document.createElement('span'); empty.textContent = 'Henüz kullanım verisi yok.'; list.append(empty); }
      data.top.forEach((item, index) => { const row = root.document.createElement('div'); row.setAttribute('role', 'listitem'); const name = root.document.createElement('span'); name.textContent = `${index + 1}. ${String(item.title || 'İsimsiz istem').slice(0, 72)}`; const count = root.document.createElement('span'); count.textContent = `${Math.max(0, Number(item.useCount) || 0)} kullanım`; row.append(name, count); list.append(row); });
      body.append(list);
      const tagTitle = root.document.createElement('strong'); tagTitle.textContent = 'Öne çıkan etiketler'; body.append(tagTitle); const tags = root.document.createElement('div'); tags.className = 'prompt-dashboard-tags';
      data.topTags.forEach(([tag, count]) => { const pill = root.document.createElement('span'); pill.textContent = `${tag} · ${count}`; tags.append(pill); }); if (!data.topTags.length) tags.textContent = 'Henüz etiket yok.'; body.append(tags);
    }
    render();
    root.addEventListener?.('storage', (event) => { if (event.key === PROMPT_KEY || event.key === COLLECTION_KEY || event.key === WORKSPACE_KEY || event.key === REVISION_KEY) render(); });
  }
  let mounted = false;
  function boot() { if (mounted || !root.document) return; const card = root.document.getElementById(CARD_ID); if (!card) return; mounted = true; new MutationObserver(inject).observe(card, { childList: true, subtree: true }); inject(); }
  root.HafizePromptLibraryDashboard = Object.freeze({ summary });
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
