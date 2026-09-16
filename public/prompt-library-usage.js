(function exposeHafizePromptUsage(root) {
  'use strict';
  const STORAGE_KEY = 'hafize.prompt-library.v1';
  const CARD_ID = 'promptLibraryCard';
  const INSIGHTS_ID = 'promptLibraryUsageInsights';
  const MAX_ITEMS = 5;
  const MAX_TEXT = 72;
  const text = (documentRef, value, className) => { const node = documentRef.createElement('span'); if (className) node.className = className; node.textContent = String(value ?? ''); return node; };
  const button = (documentRef, label) => { const node = documentRef.createElement('button'); node.type = 'button'; node.className = 'mini-btn prompt-library-usage-toggle'; node.textContent = label; return node; };
  function readItems(rootRef) { try { const raw = rootRef.localStorage?.getItem(STORAGE_KEY) || '[]'; const items = JSON.parse(raw); return Array.isArray(items) ? items.filter((item) => item && typeof item === 'object') : []; } catch { return []; } }
  function titleOf(item) { const title = typeof item.title === 'string' ? item.title.trim() : ''; return (title || 'İsimsiz istem').slice(0, MAX_TEXT); }
  function usageOf(item) { const value = Number(item.useCount); return Number.isFinite(value) && value >= 0 ? Math.min(9999, Math.floor(value)) : 0; }
  function dateValue(item) { const value = Date.parse(typeof item.updatedAt === 'string' ? item.updatedAt : ''); return Number.isFinite(value) ? value : 0; }
  function summarize(items) { const valid = items.filter((item) => typeof item.id === 'string'); const totalUses = valid.reduce((sum, item) => sum + usageOf(item), 0); const used = valid.filter((item) => usageOf(item) > 0); const top = used.slice().sort((a, b) => usageOf(b) - usageOf(a) || dateValue(b) - dateValue(a)).slice(0, MAX_ITEMS); const recent = used.slice().sort((a, b) => dateValue(b) - dateValue(a) || usageOf(b) - usageOf(a)).slice(0, MAX_ITEMS); return { total: valid.length, usedCount: used.length, totalUses, top, recent }; }
  function mount(documentRef = root.document, rootRef = root) {
    const card = documentRef?.getElementById?.(CARD_ID); if (!documentRef || !card || documentRef.getElementById(INSIGHTS_ID)) return null;
    const section = documentRef.createElement('section'); section.id = INSIGHTS_ID; section.className = 'prompt-library-usage-insights'; section.setAttribute('aria-labelledby', 'promptLibraryUsageTitle');
    const heading = documentRef.createElement('div'); heading.className = 'prompt-library-usage-head'; const title = documentRef.createElement('strong'); title.id = 'promptLibraryUsageTitle'; title.textContent = 'Kullanım istatistikleri'; const toggle = button(documentRef, 'Gizle'); toggle.setAttribute('aria-expanded', 'true'); heading.append(title, toggle);
    const body = documentRef.createElement('div'); body.className = 'prompt-library-usage-body'; section.append(heading, body); card.append(section);
    const renderList = (items, emptyLabel) => { const list = documentRef.createElement('div'); list.className = 'prompt-library-usage-list'; list.setAttribute('role', 'list'); if (!items.length) list.append(text(documentRef, emptyLabel, 'prompt-library-usage-empty')); else items.forEach((item, index) => { const row = documentRef.createElement('div'); row.className = 'prompt-library-usage-row'; row.setAttribute('role', 'listitem'); row.append(text(documentRef, `${index + 1}.`, 'prompt-library-usage-rank'), text(documentRef, titleOf(item), 'prompt-library-usage-name'), text(documentRef, `${usageOf(item)} kullanım`, 'prompt-library-usage-count')); list.append(row); }); return list; };
    const render = () => { if (!documentRef.getElementById(INSIGHTS_ID)) return; const summary = summarize(readItems(rootRef)); body.replaceChildren(); const stats = documentRef.createElement('div'); stats.className = 'prompt-library-usage-stats'; for (const [label, value] of [['Kayıt', summary.total], ['Kullanılan', summary.usedCount], ['Toplam kullanım', summary.totalUses]]) { const stat = documentRef.createElement('div'); stat.className = 'prompt-library-usage-stat'; stat.append(text(documentRef, String(value), 'prompt-library-usage-value'), text(documentRef, label, 'prompt-library-usage-label')); stats.append(stat); } body.append(stats, text(documentRef, 'En çok kullanılan', 'prompt-library-usage-subtitle'), renderList(summary.top, 'Henüz kullanılan istem yok.'), text(documentRef, 'Son kullanılan', 'prompt-library-usage-subtitle'), renderList(summary.recent, 'Son kullanım verisi bulunmuyor.')); };
    let hidden = false; toggle.addEventListener('click', () => { hidden = !hidden; body.hidden = hidden; toggle.textContent = hidden ? 'Göster' : 'Gizle'; toggle.setAttribute('aria-expanded', String(!hidden)); });
    let timer = 0; const refresh = () => { rootRef.clearTimeout?.(timer); timer = rootRef.setTimeout?.(render, 80) || 0; }; const observer = typeof MutationObserver === 'function' ? new MutationObserver(refresh) : null; const list = documentRef.getElementById('promptLibraryList'); observer?.observe(list || card, { childList: true, subtree: true }); const onStorage = (event) => { if (event.key === STORAGE_KEY) render(); }; rootRef.addEventListener?.('storage', onStorage); render();
    return Object.freeze({ mounted: true, refresh: render, summarize: () => summarize(readItems(rootRef)), destroy: () => { rootRef.clearTimeout?.(timer); observer?.disconnect(); rootRef.removeEventListener?.('storage', onStorage); section.remove(); } });
  }
  const api = Object.freeze({ STORAGE_KEY, mount, summarize, usageOf }); root.HafizePromptLibraryUsage = api; const start = () => mount(root.document, root); if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})(typeof globalThis !== 'undefined' ? globalThis : self);

(function loadPromptLibraryTrustTools(root) {
  'use strict';
  const assets = [['/prompt-library-import-preview.css', 'style'], ['/prompt-library-import-preview.js', 'script'], ['/prompt-library-bulk-organizer.css', 'style'], ['/prompt-library-bulk-organizer.js', 'script'], ['/prompt-library-diagnostics.js', 'script']];
  const loaded = new Set();
  const load = ([src, type]) => { if (loaded.has(src) || root.document.querySelector(`[src="${src}"]`) || root.document.querySelector(`[href="${src}"]`)) return; loaded.add(src); const element = root.document.createElement(type === 'style' ? 'link' : 'script'); if (type === 'style') { element.rel = 'stylesheet'; element.href = src; } else { element.src = src; element.defer = true; } (root.document.head || root.document.documentElement)?.append(element); };
  const boot = () => assets.forEach(load); if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
