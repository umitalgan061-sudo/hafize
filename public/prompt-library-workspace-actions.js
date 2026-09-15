(function installHafizePromptWorkspaceActions(root) {
  'use strict';
  const api = () => root.HafizePromptLibraryWorkspaces;
  const CARD_ID = 'promptLibraryCard';
  const clean = (value, limit) => String(value ?? '').trim().slice(0, limit);

  function cloneCurrent() {
    const source = api()?.active?.(); if (!source || !api()?.create) return null;
    const item = api().create(`${source.name} kopyası`, source.selectedIds || []);
    if (!item) return null;
    return item;
  }
  function resetCurrent() {
    const current = api()?.active?.(); if (!current || !api()?.saveCurrent) return false;
    return api().saveCurrent(current.id);
  }
  function snapshot() {
    const current = api()?.active?.();
    return current ? JSON.parse(JSON.stringify(current)) : null;
  }
  function button(text, action) { const node = root.document.createElement('button'); node.type = 'button'; node.className = 'mini-btn'; node.textContent = text; node.dataset.workspaceAction = action; return node; }
  function status(message) { const node = root.document.querySelector('#promptLibraryCard .prompt-library-status'); if (node) node.textContent = clean(message, 180); }
  let mounted = false;
  function inject() {
    const card = root.document?.getElementById?.(CARD_ID); if (!card || card.querySelector('.prompt-workspace-actions-toolbar')) return;
    const row = root.document.createElement('div'); row.className = 'prompt-workspace-actions-toolbar';
    const clone = button('Alanı çoğalt', 'clone'); const snapshotButton = button('Anlık durumu kaydet', 'snapshot'); row.append(clone, snapshotButton);
    card.querySelector('.prompt-workspace-toolbar')?.append(row);
    clone.addEventListener('click', () => { const item = cloneCurrent(); status(item ? `“${item.name}” oluşturuldu.` : 'Çalışma alanı çoğaltılamadı.'); });
    snapshotButton.addEventListener('click', () => { const ok = resetCurrent(); status(ok ? 'Mevcut çalışma durumu kaydedildi.' : 'Çalışma durumu kaydedilemedi.'); });
  }
  function boot() { if (mounted || !root.document || !api()) return; const card = root.document.getElementById(CARD_ID); if (!card) return; mounted = true; new MutationObserver(inject).observe(card, { childList: true, subtree: true }); inject(); }
  root.HafizePromptLibraryWorkspaceActions = Object.freeze({ cloneCurrent, resetCurrent, snapshot });
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
