(function installHafizePromptTemplates(root) {
  'use strict';

  const STORAGE_KEY = 'hafize.prompt-library.templates.v1';
  const MAX_TEMPLATES = 20;
  const MAX_NAME = 56;
  const MAX_STEPS = 8;
  const core = () => root.HafizePromptLibrary;
  const workflows = () => root.HafizePromptLibraryWorkflows;
  const clean = (value, limit) => String(value ?? '').trim().slice(0, limit);
  const now = () => new Date().toISOString();
  const id = () => root.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  function read() { try { const value = JSON.parse(root.localStorage?.getItem(STORAGE_KEY) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } }
  function normalize(value) {
    const seen = new Set(); const output = [];
    for (const raw of (Array.isArray(value) ? value : []).slice(0, MAX_TEMPLATES * 2)) {
      const name = clean(raw?.name, MAX_NAME); const templateId = clean(raw?.id, 120); const prompts = [...new Set((Array.isArray(raw?.promptIds) ? raw.promptIds : []).map((value) => clean(value, 120)).filter(Boolean))].slice(0, MAX_STEPS);
      if (!name || !templateId || seen.has(templateId) || !prompts.length) continue;
      seen.add(templateId); output.push({ id: templateId, name, promptIds: prompts, createdAt: clean(raw?.createdAt, 40), updatedAt: clean(raw?.updatedAt, 40) });
      if (output.length >= MAX_TEMPLATES) break;
    }
    return output;
  }
  function load() { return normalize(read()); }
  function save(value) { try { root.localStorage?.setItem(STORAGE_KEY, JSON.stringify(normalize(value))); return true; } catch { return false; } }
  function promptExists(promptId) { return Boolean(core()?.loadItems?.(root.localStorage)?.some((item) => item.id === promptId)); }
  function create(name, promptIds) {
    const value = clean(name, MAX_NAME); const ids = [...new Set((Array.isArray(promptIds) ? promptIds : []).map((item) => clean(item, 120)).filter(Boolean))].slice(0, MAX_STEPS);
    if (!value || !ids.length || ids.some((promptId) => !promptExists(promptId))) return null;
    const data = load(); if (data.length >= MAX_TEMPLATES || data.some((item) => item.name.toLocaleLowerCase('tr-TR') === value.toLocaleLowerCase('tr-TR'))) return null;
    const item = { id: id(), name: value, promptIds: ids, createdAt: now(), updatedAt: now() }; data.push(item); if (!save(data)) return null; emit(item); return item;
  }
  function remove(templateId) { const data = load(); const next = data.filter((item) => item.id !== templateId); if (next.length === data.length || !save(next)) return false; emit({ id: templateId, removed: true }); return true; }
  function build(templateId) {
    const item = load().find((entry) => entry.id === templateId); if (!item) return null;
    const validIds = item.promptIds.filter(promptExists); return validIds.length ? { ...item, promptIds: validIds } : null;
  }
  function launch(templateId) {
    const item = build(templateId); if (!item) return null;
    const workflow = workflows()?.create?.(`${item.name} çalışma`, item.promptIds); return workflow || null;
  }
  function emit(detail) { try { root.dispatchEvent?.(new root.CustomEvent('hafize:prompt-template-changed', { detail })); } catch {} }
  function button(label, action) { const node = root.document.createElement('button'); node.type = 'button'; node.className = 'mini-btn'; node.textContent = label; node.dataset.templateAction = action; return node; }
  let mounted = false;
  function inject() {
    const card = root.document?.getElementById?.('promptLibraryCard'); if (!card || card.querySelector('.prompt-template-toolbar')) return;
    const row = root.document.createElement('div'); row.className = 'prompt-template-toolbar'; const label = root.document.createElement('span'); label.textContent = 'Şablonlar'; const manage = button('Şablonları yönet', 'manage'); row.append(label, manage); card.querySelector('.prompt-workflow-toolbar, .prompt-pack-builder-toolbar, .prompt-library-filters')?.after(row); manage.addEventListener('click', openManager);
  }
  function openManager() {
    root.document.getElementById('promptTemplateManager')?.remove();
    const dialog = root.document.createElement('section'); dialog.id = 'promptTemplateManager'; dialog.className = 'prompt-template-dialog'; dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-labelledby', 'promptTemplateTitle');
    const shell = root.document.createElement('div'); shell.className = 'prompt-template-shell'; const head = root.document.createElement('div'); head.className = 'prompt-template-head'; const title = root.document.createElement('strong'); title.id = 'promptTemplateTitle'; title.textContent = 'Prompt şablonları'; const close = button('Kapat', 'close'); head.append(title, close);
    const name = root.document.createElement('input'); name.maxLength = MAX_NAME; name.placeholder = 'Şablon adı'; name.setAttribute('aria-label', 'Şablon adı'); const add = button('Seçilenlerden oluştur', 'add'); const createRow = root.document.createElement('div'); createRow.className = 'prompt-template-create'; createRow.append(name, add);
    const list = root.document.createElement('div'); list.className = 'prompt-template-list'; const status = root.document.createElement('div'); status.className = 'prompt-template-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); shell.append(head, createRow, list, status); dialog.append(shell); root.document.body.append(dialog);
    function render() { list.replaceChildren(); for (const item of load()) { const row = root.document.createElement('article'); row.className = 'prompt-template-row'; const strong = root.document.createElement('strong'); strong.textContent = item.name; const meta = root.document.createElement('span'); meta.textContent = `${item.promptIds.length} istem`; const launch = button('Workflow oluştur', 'launch'); launch.dataset.templateId = item.id; const del = button('Sil', 'delete'); del.dataset.templateId = item.id; row.append(strong, meta, launch, del); list.append(row); } if (!list.childElementCount) { const empty = root.document.createElement('p'); empty.textContent = 'Seçili istemlerle bir şablon oluşturabilirsin.'; list.append(empty); } }
    render(); close.focus?.(); close.addEventListener('click', () => dialog.remove()); add.addEventListener('click', () => { const selected = [...root.document.querySelectorAll('#promptLibraryCard [data-prompt-selection]:checked')].map((node) => node.dataset.promptSelection).filter(Boolean); const item = create(name.value, selected); status.textContent = item ? `“${item.name}” oluşturuldu.` : 'Şablon oluşturulamadı.'; name.value = ''; render(); });
    list.addEventListener('click', (event) => { const target = event.target?.closest?.('[data-template-action]'); if (!target) return; const action = target.dataset.templateAction; if (action === 'launch') { const workflow = launch(target.dataset.templateId); status.textContent = workflow ? 'Workflow oluşturuldu.' : 'Workflow oluşturulamadı.'; return; } if (action === 'delete' && root.confirm?.('Şablon silinsin mi?')) { status.textContent = remove(target.dataset.templateId) ? 'Şablon silindi.' : 'Şablon silinemedi.'; render(); } });
    dialog.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.preventDefault(); dialog.remove(); } });
  }
  function boot() { if (mounted || !root.document || !core()) return; const card = root.document.getElementById('promptLibraryCard'); if (!card) return; mounted = true; new MutationObserver(inject).observe(card, { childList: true, subtree: true }); inject(); }
  root.HafizePromptLibraryTemplates = Object.freeze({ STORAGE_KEY, MAX_TEMPLATES, load, save, create, remove, build, launch });
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
