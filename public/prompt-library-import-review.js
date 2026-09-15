(function installHafizePromptImportReview(root) {
  'use strict';

  const CARD_ID = 'promptLibraryCard';
  const MAX_BYTES = 1_500_000;
  const MAX_ITEMS = 120;
  const core = () => root.HafizePromptLibrary;
  const packs = () => root.HafizePromptLibraryPacks;
  const clean = (value, limit) => String(value ?? '').trim().slice(0, limit);

  function readText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('read-failed'));
      reader.readAsText(file);
    });
  }
  function inspect(payload) {
    const check = packs()?.validate?.(payload);
    if (!check?.ok) return { ok: false, reason: check?.reason || 'invalid', items: [], duplicates: 0, capacity: 0 };
    const normalized = packs().normalizePack(payload); if (!normalized) return { ok: false, reason: 'normalize', items: [], duplicates: 0, capacity: 0 };
    const existing = core()?.loadItems?.(root.localStorage) || [];
    const ids = new Set(existing.map((item) => item.id));
    const duplicates = normalized.prompts.filter((item) => ids.has(item.id)).length;
    return { ok: true, reason: '', items: normalized.prompts, duplicates, capacity: Math.max(0, MAX_ITEMS - existing.length), collections: Array.isArray(normalized.collections?.collections) ? normalized.collections.collections.length : 0, workspaces: Array.isArray(normalized.workspaces?.workspaces) ? normalized.workspaces.workspaces.length : 0, revisions: normalized.revisions.length };
  }
  async function readAndInspect(file) {
    if (!file || file.size > MAX_BYTES) return { ok: false, reason: 'size' };
    try { return inspect(JSON.parse(await readText(file))); } catch { return { ok: false, reason: 'parse' }; }
  }

  function button(label, action) { const node = root.document.createElement('button'); node.type = 'button'; node.className = 'mini-btn prompt-import-review-action'; node.textContent = label; node.dataset.importReviewAction = action; return node; }
  function open() {
    const card = root.document?.getElementById?.(CARD_ID); if (!card) return;
    root.document.getElementById('promptImportReview')?.remove();
    const dialog = root.document.createElement('section'); dialog.id = 'promptImportReview'; dialog.className = 'prompt-import-review-dialog'; dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-labelledby', 'promptImportReviewTitle');
    const shell = root.document.createElement('div'); shell.className = 'prompt-import-review-shell'; const head = root.document.createElement('div'); head.className = 'prompt-import-review-head'; const title = root.document.createElement('strong'); title.id = 'promptImportReviewTitle'; title.textContent = 'Paket içe aktarma incelemesi'; const close = button('Kapat', 'close'); head.append(title, close);
    const input = root.document.createElement('input'); input.type = 'file'; input.accept = 'application/json,.json'; input.setAttribute('aria-label', 'İncelenecek prompt paketi');
    const summary = root.document.createElement('div'); summary.className = 'prompt-import-review-summary'; summary.setAttribute('role', 'status'); summary.setAttribute('aria-live', 'polite'); const preview = root.document.createElement('div'); preview.className = 'prompt-import-review-preview'; const actions = root.document.createElement('div'); actions.className = 'prompt-import-review-actions'; const accept = button('İçe aktar', 'accept'); accept.disabled = true; actions.append(accept); shell.append(head, input, summary, preview, actions); dialog.append(shell); root.document.body.append(dialog); close.focus?.();
    let current = null;
    input.addEventListener('change', async () => {
      current = null; accept.disabled = true; preview.replaceChildren(); summary.textContent = 'Paket okunuyor…';
      const result = await readAndInspect(input.files?.[0]); if (!result.ok) { summary.textContent = `Paket incelenemedi (${clean(result.reason, 32)}).`; return; }
      current = input.files?.[0]; const duplicateText = result.duplicates ? ` · ${result.duplicates} mevcut` : ''; summary.textContent = `${result.items.length} istem · ${result.collections} koleksiyon · ${result.workspaces} çalışma alanı · ${result.revisions} revizyon${duplicateText}`;
      for (const item of result.items.slice(0, 12)) { const row = root.document.createElement('div'); row.className = 'prompt-import-review-row'; const name = root.document.createElement('strong'); name.textContent = item.title; const body = root.document.createElement('span'); body.textContent = item.body.replace(/\s+/g, ' ').slice(0, 120); row.append(name, body); preview.append(row); }
      if (result.items.length > 12) { const more = root.document.createElement('div'); more.textContent = `+${result.items.length - 12} istem daha`; preview.append(more); }
      accept.disabled = result.items.length === 0 || result.capacity === 0;
    });
    accept.addEventListener('click', async () => { if (!current || !packs()) return; try { const data = JSON.parse(await readText(current)); const result = packs().importPayload(data); summary.textContent = result ? `${result.added} istem içe aktarıldı, ${result.duplicates} tekrar atlandı.` : 'Paket içe aktarılamadı.'; accept.disabled = true; } catch { summary.textContent = 'Paket içe aktarılamadı.'; } });
    close.addEventListener('click', () => dialog.remove()); dialog.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.preventDefault(); dialog.remove(); } });
  }
  function inject() {
    const card = root.document?.getElementById?.(CARD_ID); if (!card || card.querySelector('.prompt-import-review-toolbar')) return;
    const row = root.document.createElement('div'); row.className = 'prompt-import-review-toolbar'; const label = root.document.createElement('span'); label.textContent = 'Güvenli içe aktarma'; const openButton = button('Paketi incele', 'open'); row.append(label, openButton); card.querySelector('.prompt-pack-toolbar, .prompt-workflow-toolbar, .prompt-batch-toolbar, .prompt-library-filters')?.after(row); openButton.addEventListener('click', open);
  }
  let mounted = false; function boot() { if (mounted || !root.document || !core()) return; const card = root.document.getElementById(CARD_ID); if (!card) return; mounted = true; new MutationObserver(inject).observe(card, { childList: true, subtree: true }); inject(); }
  root.HafizePromptLibraryImportReview = Object.freeze({ inspect, readAndInspect, open });
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
