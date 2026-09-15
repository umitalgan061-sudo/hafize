(function installHafizePromptPackBuilder(root) {
  'use strict';

  const MAX_ITEMS = 40;
  const MAX_BYTES = 1_500_000;
  const core = () => root.HafizePromptLibrary;
  const packs = () => root.HafizePromptLibraryPacks;
  const workspaces = () => root.HafizePromptLibraryWorkspaces;
  const collections = () => root.HafizePromptLibraryCollections;
  const revisions = () => root.HafizePromptLibraryRevisions;
  const clean = (value, limit) => String(value ?? '').trim().slice(0, limit);

  function selectedIds() {
    const card = root.document?.getElementById?.('promptLibraryCard');
    return card ? [...card.querySelectorAll('[data-prompt-selection]:checked')].map((node) => clean(node.dataset.promptSelection, 120)).filter(Boolean).slice(0, MAX_ITEMS) : [];
  }
  function build(ids = selectedIds(), options = {}) {
    const allowed = new Set(ids);
    const prompts = (core()?.loadItems?.(root.localStorage) || []).filter((item) => allowed.has(item.id)).slice(0, MAX_ITEMS);
    if (!prompts.length) return null;
    const data = {
      packVersion: 1,
      source: 'hafize-prompt-pack',
      exportedAt: new Date().toISOString(),
      prompts,
      state: options.includeState === false ? {} : core()?.loadState?.(root.localStorage) || {},
      collections: options.includeCollections === false ? {} : collections()?.load?.() || {},
      workspaces: options.includeWorkspaces === false ? {} : workspaces()?.load?.() || {},
      revisions: options.includeRevisions === false ? [] : (revisions()?.load?.() || []).filter((item) => allowed.has(item.promptId)).slice(0, 120)
    };
    const output = JSON.stringify(data, null, 2);
    return output.length <= MAX_BYTES ? output : null;
  }
  function inspect(ids = selectedIds()) {
    const result = build(ids); return result ? { ids: JSON.parse(result).prompts.map((item) => item.id), chars: result.length, withinLimit: result.length <= MAX_BYTES } : null;
  }
  function download(ids = selectedIds(), options = {}) {
    const output = build(ids, options); if (!output || !root.document) return false;
    const blob = new Blob([output], { type: 'application/json;charset=utf-8' }); const url = root.URL.createObjectURL(blob);
    const link = root.document.createElement('a'); link.href = url; link.download = clean(options.filename, 80) || 'hafize-selected-prompts.json'; link.click(); root.setTimeout?.(() => root.URL.revokeObjectURL(url), 0); return true;
  }
  function button(text, action) { const node = root.document.createElement('button'); node.type = 'button'; node.className = 'mini-btn'; node.textContent = text; node.dataset.packBuilderAction = action; return node; }
  let mounted = false;
  function open() {
    root.document.getElementById('promptPackBuilder')?.remove();
    const dialog = root.document.createElement('section'); dialog.id = 'promptPackBuilder'; dialog.className = 'prompt-pack-builder-dialog'; dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-labelledby', 'promptPackBuilderTitle');
    const shell = root.document.createElement('div'); shell.className = 'prompt-pack-builder-shell'; const head = root.document.createElement('div'); head.className = 'prompt-pack-builder-head'; const title = root.document.createElement('strong'); title.id = 'promptPackBuilderTitle'; title.textContent = 'Seçili istemleri paketle'; const close = button('Kapat', 'close'); head.append(title, close);
    const includeCollections = root.document.createElement('input'); includeCollections.type = 'checkbox'; includeCollections.checked = true; includeCollections.setAttribute('aria-label', 'Koleksiyonları dahil et');
    const includeWorkspaces = root.document.createElement('input'); includeWorkspaces.type = 'checkbox'; includeWorkspaces.checked = true; includeWorkspaces.setAttribute('aria-label', 'Çalışma alanlarını dahil et');
    const includeRevisions = root.document.createElement('input'); includeRevisions.type = 'checkbox'; includeRevisions.checked = true; includeRevisions.setAttribute('aria-label', 'Revizyonları dahil et');
    const filename = root.document.createElement('input'); filename.maxLength = 80; filename.placeholder = 'Dosya adı'; filename.setAttribute('aria-label', 'Paket dosya adı');
    const summary = root.document.createElement('div'); summary.className = 'prompt-pack-builder-summary'; summary.setAttribute('role', 'status'); summary.setAttribute('aria-live', 'polite');
    const exportButton = button('Paket indir', 'export'); const previewButton = button('Önizle', 'preview'); const actions = root.document.createElement('div'); actions.className = 'prompt-pack-builder-actions'; actions.append(previewButton, exportButton);
    shell.append(head, label('Koleksiyonları dahil et', includeCollections), label('Çalışma alanlarını dahil et', includeWorkspaces), label('Revizyonları dahil et', includeRevisions), label('Dosya adı', filename), summary, actions); dialog.append(shell); root.document.body.append(dialog); close.focus?.();
    function refresh() { const result = inspect(); summary.textContent = result ? `${result.ids.length} istem · ${result.chars} karakter` : 'Önce istem seçmelisin.'; exportButton.disabled = !result; }
    refresh(); previewButton.addEventListener('click', refresh); exportButton.addEventListener('click', () => { const ok = download(selectedIds(), { includeCollections: includeCollections.checked, includeWorkspaces: includeWorkspaces.checked, includeRevisions: includeRevisions.checked, filename: filename.value }); summary.textContent = ok ? 'Paket indirildi.' : 'Paket oluşturulamadı.'; }); close.addEventListener('click', () => dialog.remove()); dialog.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.preventDefault(); dialog.remove(); } });
  }
  function label(text, control) { const node = root.document.createElement('label'); node.className = 'prompt-pack-builder-label'; node.append(root.document.createTextNode(text), control); return node; }
  function inject() { const card = root.document?.getElementById?.('promptLibraryCard'); if (!card || card.querySelector('.prompt-pack-builder-toolbar')) return; const row = root.document.createElement('div'); row.className = 'prompt-pack-builder-toolbar'; const label = root.document.createElement('span'); label.textContent = 'Seçimli paket'; const openButton = button('Seçimi paketle', 'open'); row.append(label, openButton); card.querySelector('.prompt-batch-toolbar, .prompt-pack-toolbar, .prompt-workflow-toolbar, .prompt-library-filters')?.after(row); openButton.addEventListener('click', open); }
  function boot() { if (mounted || !root.document || !core()) return; const card = root.document.getElementById('promptLibraryCard'); if (!card) return; mounted = true; new MutationObserver(inject).observe(card, { childList: true, subtree: true }); inject(); }
  root.HafizePromptLibraryPackBuilder = Object.freeze({ selectedIds, build, inspect, download });
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
