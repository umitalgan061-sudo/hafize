(function installHafizePromptRecovery(root) {
  'use strict';

  const WORKSPACE_KEY = 'hafize.prompt-library.workspaces.v1';
  const COLLECTION_KEY = 'hafize.prompt-library.collections.v1';
  const REVISION_KEY = 'hafize.prompt-library.revisions.v1';
  const PROMPT_KEY = 'hafize.prompt-library.v1';
  const MAX_SNAPSHOT = 900_000;

  function read(key) { try { return JSON.parse(root.localStorage?.getItem(key) || 'null'); } catch { return null; } }
  function snapshot() {
    const data = { prompts: read(PROMPT_KEY), workspaces: read(WORKSPACE_KEY), collections: read(COLLECTION_KEY), revisions: read(REVISION_KEY), createdAt: new Date().toISOString() };
    const output = JSON.stringify(data);
    return output.length <= MAX_SNAPSHOT ? output : null;
  }
  function resetPreferences() {
    try {
      const current = read(WORKSPACE_KEY) || { version: 1, activeId: 'default', workspaces: [] };
      const general = (Array.isArray(current.workspaces) ? current.workspaces : []).find((item) => item?.id === 'default') || { id: 'default', name: 'Genel', createdAt: '', updatedAt: '', tags: [], selectedIds: [], state: { query: '', tag: 'all', favoriteOnly: false, sort: 'updated-desc' } };
      root.localStorage?.setItem(WORKSPACE_KEY, JSON.stringify({ version: 1, activeId: 'default', workspaces: [general] }));
      try { root.localStorage?.setItem(`${PROMPT_KEY}.state`, JSON.stringify({ query: '', tag: 'all', favoriteOnly: false, sort: 'updated-desc' })); } catch {}
      root.dispatchEvent?.(new root.CustomEvent('hafize:prompt-workspace-recovered', { detail: { resetPreferences: true } }));
      return true;
    } catch { return false; }
  }
  function clearWorkspaceOnly() {
    try { root.localStorage?.removeItem(WORKSPACE_KEY); root.dispatchEvent?.(new root.CustomEvent('hafize:prompt-workspace-recovered', { detail: { workspaceCleared: true } })); return true; } catch { return false; }
  }
  function button(label, action) { const node = root.document.createElement('button'); node.type = 'button'; node.className = 'mini-btn'; node.textContent = label; node.dataset.recoveryAction = action; return node; }
  let mounted = false;
  function open() {
    root.document.getElementById('promptWorkspaceRecovery')?.remove();
    const dialog = root.document.createElement('section'); dialog.id = 'promptWorkspaceRecovery'; dialog.className = 'prompt-recovery-dialog'; dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-labelledby', 'promptRecoveryTitle');
    const shell = root.document.createElement('div'); shell.className = 'prompt-recovery-shell'; const head = root.document.createElement('div'); head.className = 'prompt-recovery-head'; const title = root.document.createElement('strong'); title.id = 'promptRecoveryTitle'; title.textContent = 'Çalışma alanı kurtarma'; const close = button('Kapat', 'close'); head.append(title, close);
    const info = root.document.createElement('p'); info.textContent = 'Kurtarma işlemleri prompt kayıtlarını silmeden workspace tercihlerini varsayılana döndürür.';
    const backup = button('Önce snapshot hazırla', 'snapshot'); const reset = button('Tercihleri sıfırla', 'reset'); const clear = button('Workspace kayıtlarını temizle', 'clear'); const actions = root.document.createElement('div'); actions.className = 'prompt-recovery-actions'; actions.append(backup, reset, clear);
    const status = root.document.createElement('div'); status.className = 'prompt-recovery-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); shell.append(head, info, actions, status); dialog.append(shell); root.document.body.append(dialog);
    close.focus?.(); close.addEventListener('click', () => dialog.remove());
    backup.addEventListener('click', () => { const output = snapshot(); if (!output) { status.textContent = 'Snapshot sınırı aşıldı.'; return; } const blob = new Blob([output], { type: 'application/json;charset=utf-8' }); const url = root.URL.createObjectURL(blob); const link = root.document.createElement('a'); link.href = url; link.download = 'hafize-prompt-recovery.json'; link.click(); root.setTimeout?.(() => root.URL.revokeObjectURL(url), 0); status.textContent = 'Snapshot hazırlandı.'; });
    reset.addEventListener('click', () => { if (root.confirm?.('Workspace tercihleri sıfırlansın mı? Prompt kayıtları korunur.')) status.textContent = resetPreferences() ? 'Tercihler sıfırlandı.' : 'Sıfırlama başarısız.'; });
    clear.addEventListener('click', () => { if (root.confirm?.('Workspace kayıtları temizlensin mi? Prompt kayıtları korunur.')) status.textContent = clearWorkspaceOnly() ? 'Workspace kayıtları temizlendi.' : 'Temizleme başarısız.'; });
    dialog.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.preventDefault(); dialog.remove(); } });
  }
  function inject() { const card = root.document?.getElementById?.('promptLibraryCard'); if (!card || card.querySelector('.prompt-recovery-toolbar')) return; const row = root.document.createElement('div'); row.className = 'prompt-recovery-toolbar'; const label = root.document.createElement('span'); label.textContent = 'Kurtarma'; const openButton = button('Güvenli sıfırlama', 'open'); row.append(label, openButton); card.querySelector('.prompt-dashboard, .prompt-workspace-toolbar, .prompt-library-filters')?.after(row); openButton.addEventListener('click', open); }
  function boot() { if (mounted || !root.document) return; const card = root.document.getElementById('promptLibraryCard'); if (!card) return; mounted = true; new MutationObserver(inject).observe(card, { childList: true, subtree: true }); inject(); }
  root.HafizePromptLibraryRecovery = Object.freeze({ snapshot, resetPreferences, clearWorkspaceOnly });
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
