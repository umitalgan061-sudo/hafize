(function installHafizePromptSmartInsert(root) {
  'use strict';

  const MAX_APPEND = 4;
  const MAX_LENGTH = 12000;
  const PROMPT_KEY = 'hafize.prompt-library.v1';
  const core = () => root.HafizePromptLibrary;
  const cleanId = (value) => String(value ?? '').trim().slice(0, 120);

  function load() { return core()?.loadItems?.(root.localStorage) || []; }
  function get(id) { return load().find((item) => item.id === cleanId(id)) || null; }
  function compose(ids, variables = {}) {
    const unique = [...new Set((Array.isArray(ids) ? ids : []).map(cleanId).filter(Boolean))].slice(0, MAX_APPEND);
    const entries = unique.map(get).filter(Boolean);
    if (!entries.length || !core()) return null;
    const parts = entries.map((item) => core().replaceVariables(item.body, variables).slice(0, MAX_LENGTH));
    return { ids: entries.map((item) => item.id), titles: entries.map((item) => item.title), text: parts.join('\n\n').slice(0, MAX_LENGTH) };
  }
  function insert(ids, options = {}) {
    const composer = root.document?.getElementById?.('messageInput');
    if (!composer) return null;
    const result = compose(ids, options.variables || {}); if (!result) return null;
    const mode = options.mode === 'append' ? 'append' : 'replace';
    const existing = typeof composer.value === 'string' ? composer.value : '';
    composer.value = mode === 'append' && existing ? `${existing}\n\n${result.text}`.slice(0, MAX_LENGTH) : result.text;
    composer.dispatchEvent(new Event('input', { bubbles: true })); composer.focus();
    try { root.dispatchEvent?.(new root.CustomEvent('hafize:prompt-smart-inserted', { detail: result })); } catch {}
    return result;
  }
  function estimate(ids) { const result = compose(ids); return result ? { chars: result.text.length, withinLimit: result.text.length <= MAX_LENGTH, count: result.ids.length } : null; }
  function attachButtons(card) {
    for (const row of card.querySelectorAll('.prompt-item')) {
      const actions = row.querySelector('.prompt-item-actions'); const id = row.dataset.promptId;
      if (!actions || !id || actions.querySelector('[data-smart-insert]')) continue;
      const node = root.document.createElement('button'); node.type = 'button'; node.className = 'mini-btn'; node.textContent = 'Ekle'; node.dataset.smartInsert = id; node.setAttribute('aria-label', 'İstemi composer alanına ekle');
      node.addEventListener('click', () => insert([id])); actions.append(node);
    }
  }
  let mounted = false;
  function boot() {
    if (mounted || !root.document || !core()) return;
    const card = root.document.getElementById('promptLibraryCard'); if (!card) return;
    mounted = true;
    const observer = new MutationObserver(() => attachButtons(card)); observer.observe(card, { childList: true, subtree: true });
    attachButtons(card);
  }
  root.HafizePromptLibrarySmartInsert = Object.freeze({ PROMPT_KEY, MAX_APPEND, MAX_LENGTH, load, get, compose, insert, estimate });
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
