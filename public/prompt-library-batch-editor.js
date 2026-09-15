(function installHafizePromptBatchEditor(root) {
  'use strict';

  const MAX_SELECTION = 40;
  const MAX_TAGS = 8;
  const MAX_TAG = 24;
  const CARD_ID = 'promptLibraryCard';
  const core = () => root.HafizePromptLibrary;
  const collections = () => root.HafizePromptLibraryCollections;
  const clean = (value, limit) => String(value ?? '').trim().slice(0, limit);
  const storage = () => root.localStorage;

  function load() { return core()?.loadItems?.(storage()) || []; }
  function save(items) { return core()?.saveItems?.(storage(), items) === true; }
  function selected(card) { return [...card.querySelectorAll('[data-prompt-selection]:checked')].map((node) => clean(node.dataset.promptSelection, 120)).filter(Boolean).slice(0, MAX_SELECTION); }
  function normalizeTags(value) { return [...new Set(String(value ?? '').split(',').map((tag) => clean(tag, MAX_TAG)).filter(Boolean))].slice(0, MAX_TAGS); }
  function apply(ids, patch = {}) {
    const idSet = new Set(ids); const items = load(); let changed = 0;
    const next = items.map((item) => {
      if (!idSet.has(item.id)) return item;
      const updated = core().normalizeItem({ ...item, ...patch, updatedAt: new Date().toISOString() });
      if (!updated) return item;
      changed += 1; return updated;
    });
    if (!changed || !save(next)) return false;
    try { root.dispatchEvent?.(new root.StorageEvent('storage', { key: core().STORAGE_KEY, newValue: JSON.stringify(next), storageArea: storage() })); } catch {}
    return true;
  }
  function open() {
    const card = root.document?.getElementById?.(CARD_ID); if (!card) return;
    root.document.getElementById('promptBatchEditor')?.remove();
    const ids = selected(card); if (!ids.length) { status('Toplu düzenleme için istem seç.'); return; }
    const dialog = root.document.createElement('section'); dialog.id = 'promptBatchEditor'; dialog.className = 'prompt-batch-dialog';
    dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-labelledby', 'promptBatchTitle');
    const shell = root.document.createElement('div'); shell.className = 'prompt-batch-shell';
    const head = root.document.createElement('div'); head.className = 'prompt-batch-head'; const title = root.document.createElement('strong'); title.id = 'promptBatchTitle'; title.textContent = `${ids.length} istemi toplu düzenle`; const close = button('Kapat', 'close'); head.append(title, close);
    const tags = root.document.createElement('input'); tags.maxLength = 220; tags.placeholder = 'Etiketleri ayarla: kod, plan, sık'; tags.setAttribute('aria-label', 'Etiketleri ayarla');
    const collection = root.document.createElement('select'); collection.setAttribute('aria-label', 'Koleksiyon ata');
    const favorite = root.document.createElement('select'); favorite.setAttribute('aria-label', 'Favori durumunu ayarla');
    for (const [value, label] of [['', 'Favori durumunu değiştirme'], ['true', 'Favori yap'], ['false', 'Favoriden çıkar']]) { const option = root.document.createElement('option'); option.value = value; option.textContent = label; favorite.append(option); }
    if (collections()?.load) for (const item of collections().load().collections) { const option = root.document.createElement('option'); option.value = item.id; option.textContent = item.name; collection.append(option); }
    const actions = root.document.createElement('div'); actions.className = 'prompt-batch-actions'; const applyButton = button('Uygula', 'apply'); actions.append(applyButton);
    const statusNode = root.document.createElement('div'); statusNode.className = 'prompt-batch-status'; statusNode.setAttribute('role', 'status'); statusNode.setAttribute('aria-live', 'polite'); shell.append(head, label('Etiketler', tags), label('Koleksiyon', collection), label('Favori', favorite), actions, statusNode); dialog.append(shell); root.document.body.append(dialog); close.focus?.();
    close.addEventListener('click', () => dialog.remove());
    applyButton.addEventListener('click', () => {
      const patch = {}; if (tags.value.trim()) patch.tags = normalizeTags(tags.value); if (favorite.value) patch.favorite = favorite.value === 'true';
      const ok = apply(ids, patch); if (ok && collection.value && collection.value !== 'all') collections()?.assignMany?.(ids, collection.value); statusNode.textContent = ok ? `${ids.length} istem güncellendi.` : 'Toplu güncelleme yapılamadı.'; if (ok) root.setTimeout?.(() => dialog.remove(), 400);
    });
    dialog.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.preventDefault(); dialog.remove(); } });
  }
  function label(text, input) { const node = root.document.createElement('label'); node.className = 'prompt-batch-label'; node.append(root.document.createTextNode(text), input); return node; }
  function button(text, action) { const node = root.document.createElement('button'); node.type = 'button'; node.className = 'mini-btn'; node.textContent = text; node.dataset.batchAction = action; node.setAttribute('aria-label', text); return node; }
  function status(message) { const node = root.document.querySelector('#promptLibraryCard .prompt-library-status'); if (node) node.textContent = clean(message, 180); }
  let mounted = false;
  function inject() {
    const card = root.document?.getElementById?.(CARD_ID); if (!card || card.querySelector('.prompt-batch-toolbar')) return;
    const toolbar = root.document.createElement('div'); toolbar.className = 'prompt-batch-toolbar'; const info = root.document.createElement('span'); info.textContent = 'Toplu düzenleme'; const edit = button('Toplu düzenle', 'open'); toolbar.append(info, edit); card.querySelector('.prompt-workflow-toolbar, .prompt-pack-toolbar, .prompt-workspace-toolbar, .prompt-collection-toolbar, .prompt-library-enhancement-toolbar, .prompt-library-filters')?.after(toolbar); edit.addEventListener('click', open);
  }
  function boot() { if (mounted || !root.document || !core()) return; if (!root.document.getElementById(CARD_ID)) return; mounted = true; new MutationObserver(inject).observe(root.document.getElementById(CARD_ID), { childList: true, subtree: true }); inject(); }
  root.HafizePromptLibraryBatchEditor = Object.freeze({ load, selected, normalizeTags, apply, open });
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
