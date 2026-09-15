(function installHafizePromptWorkspaceDiff(root) {
  'use strict';

  const api = () => root.HafizePromptLibraryWorkspaces;
  const core = () => root.HafizePromptLibrary;
  const MAX_FIELDS = 12;
  const clean = (value, limit) => String(value ?? '').slice(0, limit);

  function compare(left, right) {
    const a = left || {}; const b = right || {}; const changes = [];
    const fields = ['name', 'selectedIds', 'state', 'tags'];
    for (const field of fields) {
      const x = JSON.stringify(a[field] ?? null); const y = JSON.stringify(b[field] ?? null);
      if (x !== y) changes.push({ field, before: clean(x, 400), after: clean(y, 400) });
      if (changes.length >= MAX_FIELDS) break;
    }
    return { changed: changes.length > 0, changes };
  }

  function currentVsSaved() {
    const current = api()?.active?.(); if (!current || !core()) return null;
    const state = core().loadState(root.localStorage);
    const live = { ...current, state };
    return compare(current, live);
  }

  function open() {
    const current = api()?.active?.(); if (!current || !root.document) return null;
    root.document.getElementById('promptWorkspaceDiff')?.remove();
    const dialog = root.document.createElement('section'); dialog.id = 'promptWorkspaceDiff'; dialog.className = 'prompt-workspace-diff-dialog'; dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-labelledby', 'promptWorkspaceDiffTitle');
    const shell = root.document.createElement('div'); shell.className = 'prompt-workspace-diff-shell'; const head = root.document.createElement('div'); head.className = 'prompt-workspace-diff-head'; const title = root.document.createElement('strong'); title.id = 'promptWorkspaceDiffTitle'; title.textContent = `Çalışma alanı özeti · ${clean(current.name, 56)}`;
    const close = button('Kapat', 'close'); head.append(title, close); const body = root.document.createElement('div'); body.className = 'prompt-workspace-diff-body';
    const result = currentVsSaved(); const summary = root.document.createElement('p'); summary.textContent = result?.changed ? `${result.changes.length} alan farklı.` : 'Kaydedilmiş ve mevcut durum aynı.'; body.append(summary);
    for (const change of result?.changes || []) { const row = root.document.createElement('div'); row.className = 'prompt-workspace-diff-row'; const field = root.document.createElement('strong'); field.textContent = change.field; const before = root.document.createElement('span'); before.textContent = `Önce: ${change.before}`; const after = root.document.createElement('span'); after.textContent = `Şimdi: ${change.after}`; row.append(field, before, after); body.append(row); }
    shell.append(head, body); dialog.append(shell); root.document.body.append(dialog); close.focus?.(); close.addEventListener('click', () => dialog.remove()); dialog.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.preventDefault(); dialog.remove(); } });
    return result;
  }
  function button(label, action) { const node = root.document.createElement('button'); node.type = 'button'; node.className = 'mini-btn'; node.textContent = label; node.dataset.workspaceDiffAction = action; return node; }
  let mounted = false;
  function inject() { const toolbar = root.document?.querySelector?.('#promptLibraryCard .prompt-workspace-actions-toolbar'); if (!toolbar || toolbar.querySelector('[data-workspace-diff]')) return; const node = button('Durumu karşılaştır', 'open'); node.dataset.workspaceDiff = 'true'; toolbar.append(node); node.addEventListener('click', open); }
  function boot() { if (mounted || !root.document || !api()) return; const card = root.document.getElementById('promptLibraryCard'); if (!card) return; mounted = true; new MutationObserver(inject).observe(card, { childList: true, subtree: true }); inject(); }
  root.HafizePromptLibraryWorkspaceDiff = Object.freeze({ compare, currentVsSaved, open });
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
