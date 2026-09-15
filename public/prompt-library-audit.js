(function installHafizePromptAudit(root) {
  'use strict';

  const PROMPT_KEY = 'hafize.prompt-library.v1';
  const COLLECTION_KEY = 'hafize.prompt-library.collections.v1';
  const WORKSPACE_KEY = 'hafize.prompt-library.workspaces.v1';
  const REVISION_KEY = 'hafize.prompt-library.revisions.v1';
  const CARD_ID = 'promptLibraryCard';
  const AUDIT_ID = 'promptLibraryAudit';
  const MAX_ISSUES = 24;

  function read(key, fallback) {
    try { const value = JSON.parse(root.localStorage?.getItem(key) || 'null'); return value ?? fallback; }
    catch { return fallback; }
  }
  const clean = (value, limit) => String(value ?? '').trim().slice(0, limit);
  function audit() {
    const prompts = Array.isArray(read(PROMPT_KEY, [])) ? read(PROMPT_KEY, []) : [];
    const collections = read(COLLECTION_KEY, {});
    const workspaces = read(WORKSPACE_KEY, {});
    const revisions = Array.isArray(read(REVISION_KEY, [])) ? read(REVISION_KEY, []) : [];
    const promptIds = new Set(prompts.filter((item) => item && typeof item.id === 'string').map((item) => item.id));
    const issues = [];
    let duplicateIds = 0; const seen = new Set();
    for (const item of prompts) { if (!item?.id) continue; if (seen.has(item.id)) duplicateIds += 1; seen.add(item.id); }
    if (duplicateIds) issues.push(`Tekrarlı istem kimliği: ${duplicateIds}`);
    if (prompts.length > 120) issues.push('İstem sayısı üst sınırı aşıyor.');
    if (revisions.some((item) => item?.promptId && !promptIds.has(item.promptId))) issues.push('Bazı revizyonlar artık bulunmayan istemlere işaret ediyor.');
    if (collections?.assignments && typeof collections.assignments === 'object') {
      const collectionIds = new Set((Array.isArray(collections.collections) ? collections.collections : []).map((item) => item?.id));
      const orphanAssignments = Object.entries(collections.assignments).filter(([promptId, collectionId]) => promptIds.has(promptId) && !collectionIds.has(collectionId)).length;
      if (orphanAssignments) issues.push(`Geçersiz koleksiyon ataması: ${orphanAssignments}`);
    }
    if (workspaces?.workspaces && Array.isArray(workspaces.workspaces)) {
      const stale = workspaces.workspaces.reduce((sum, item) => sum + (Array.isArray(item?.selectedIds) ? item.selectedIds.filter((id) => !promptIds.has(id)).length : 0), 0);
      if (stale) issues.push(`Çalışma alanlarında eski istem seçimi: ${stale}`);
    }
    return { ok: issues.length === 0, promptCount: prompts.length, collectionCount: Array.isArray(collections?.collections) ? collections.collections.length : 0, workspaceCount: Array.isArray(workspaces?.workspaces) ? workspaces.workspaces.length : 0, revisionCount: revisions.length, issues: issues.slice(0, MAX_ISSUES) };
  }

  function button(doc, label) { const node = doc.createElement('button'); node.type = 'button'; node.className = 'mini-btn'; node.textContent = label; return node; }
  let mounted = false;
  function inject() {
    const card = root.document?.getElementById?.(CARD_ID); if (!card || root.document.getElementById(AUDIT_ID)) return;
    const section = root.document.createElement('section'); section.id = AUDIT_ID; section.className = 'prompt-library-audit'; section.setAttribute('aria-labelledby', 'promptLibraryAuditTitle');
    const head = root.document.createElement('div'); head.className = 'prompt-library-audit-head'; const title = root.document.createElement('strong'); title.id = 'promptLibraryAuditTitle'; title.textContent = 'Kütüphane sağlığı'; const run = button(root.document, 'Denetle'); head.append(title, run);
    const result = root.document.createElement('div'); result.className = 'prompt-library-audit-result'; result.setAttribute('role', 'status'); result.setAttribute('aria-live', 'polite'); section.append(head, result); card.append(section);
    function render() {
      const data = audit(); result.replaceChildren();
      const summary = root.document.createElement('p'); summary.textContent = data.ok ? `Sağlıklı · ${data.promptCount} istem · ${data.revisionCount} revizyon` : `Düzeltme gerekli · ${data.issues.length} uyarı`;
      result.append(summary);
      for (const issue of data.issues) { const row = root.document.createElement('div'); row.textContent = issue; result.append(row); }
    }
    run.addEventListener('click', render); render();
  }
  function boot() { if (mounted || !root.document) return; const card = root.document.getElementById(CARD_ID); if (!card) return; mounted = true; new MutationObserver(inject).observe(card, { childList: true, subtree: true }); inject(); }
  root.HafizePromptLibraryAudit = Object.freeze({ audit });
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
