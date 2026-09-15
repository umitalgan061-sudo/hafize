(function installHafizePromptWorkflows(root) {
  'use strict';

  const STORAGE_KEY = 'hafize.prompt-library.workflows.v1';
  const PROMPT_KEY = 'hafize.prompt-library.v1';
  const CARD_ID = 'promptLibraryCard';
  const MAX_WORKFLOWS = 24;
  const MAX_STEPS = 8;
  const MAX_NAME = 64;
  const MAX_NOTE = 200;
  const MAX_SELECTED = 40;
  const MAX_STEP_OUTPUT = 12000;
  const core = () => root.HafizePromptLibrary;
  const clean = (value, limit) => String(value ?? '').trim().slice(0, limit);
  const now = () => new Date().toISOString();
  const makeId = () => root.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  function read() {
    try { const value = JSON.parse(root.localStorage?.getItem(STORAGE_KEY) || '{}'); return value && typeof value === 'object' ? value : {}; }
    catch { return {}; }
  }
  function normalize(value) {
    const source = value && typeof value === 'object' ? value : {};
    const raw = Array.isArray(source.workflows) ? source.workflows : [];
    const workflows = [];
    const seen = new Set();
    for (const item of raw.slice(0, MAX_WORKFLOWS)) {
      const id = clean(item?.id, 120); const name = clean(item?.name, MAX_NAME);
      if (!id || !name || seen.has(id)) continue;
      const rawSteps = Array.isArray(item?.steps) ? item.steps : [];
      const steps = [];
      const stepIds = new Set();
      for (const rawStep of rawSteps.slice(0, MAX_STEPS)) {
        const stepId = clean(rawStep?.id, 120) || makeId();
        const promptId = clean(rawStep?.promptId, 120);
        if (!promptId || stepIds.has(stepId)) continue;
        stepIds.add(stepId);
        steps.push({ id: stepId, promptId, mode: rawStep?.mode === 'append' ? 'append' : 'replace', note: clean(rawStep?.note, MAX_NOTE) });
      }
      if (!steps.length) continue;
      seen.add(id);
      workflows.push({ id, name, steps, createdAt: clean(item?.createdAt, 40), updatedAt: clean(item?.updatedAt, 40) });
    }
    const activeId = seen.has(clean(source.activeId, 120)) ? clean(source.activeId, 120) : '';
    return { version: 1, activeId, workflows };
  }
  function load() { return normalize(read()); }
  function save(value) { try { root.localStorage?.setItem(STORAGE_KEY, JSON.stringify(normalize(value))); return true; } catch { return false; } }
  function listPrompts() { return core()?.loadItems?.(root.localStorage) || []; }
  function promptById(id) { return listPrompts().find((item) => item.id === id) || null; }
  function create(name, promptIds = []) {
    const cleanName = clean(name, MAX_NAME);
    const ids = [...new Set(promptIds.map((value) => clean(value, 120)).filter(Boolean))].slice(0, MAX_STEPS);
    if (!cleanName || !ids.length) return null;
    if (ids.some((id) => !promptById(id))) return null;
    const data = load();
    if (data.workflows.length >= MAX_WORKFLOWS || data.workflows.some((item) => item.name.toLocaleLowerCase('tr-TR') === cleanName.toLocaleLowerCase('tr-TR'))) return null;
    const item = { id: makeId(), name: cleanName, steps: ids.map((promptId) => ({ id: makeId(), promptId, mode: 'replace', note: '' })), createdAt: now(), updatedAt: now() };
    data.workflows.push(item); data.activeId = item.id;
    if (!save(data)) return null;
    emit('hafize:prompt-workflow-changed', item); return item;
  }
  function update(id, patch = {}) {
    const data = load(); const item = data.workflows.find((candidate) => candidate.id === id);
    if (!item) return false;
    if (patch.name !== undefined) {
      const name = clean(patch.name, MAX_NAME);
      if (!name || data.workflows.some((candidate) => candidate.id !== id && candidate.name.toLocaleLowerCase('tr-TR') === name.toLocaleLowerCase('tr-TR'))) return false;
      item.name = name;
    }
    if (Array.isArray(patch.steps)) {
      const steps = patch.steps.slice(0, MAX_STEPS).map((step) => ({ id: clean(step?.id, 120) || makeId(), promptId: clean(step?.promptId, 120), mode: step?.mode === 'append' ? 'append' : 'replace', note: clean(step?.note, MAX_NOTE) })).filter((step) => step.promptId && promptById(step.promptId));
      if (!steps.length) return false;
      item.steps = steps;
    }
    item.updatedAt = now();
    const ok = save(data); if (ok) emit('hafize:prompt-workflow-changed', item); return ok;
  }
  function remove(id) {
    const data = load(); if (!data.workflows.some((item) => item.id === id)) return false;
    data.workflows = data.workflows.filter((item) => item.id !== id); if (data.activeId === id) data.activeId = '';
    const ok = save(data); if (ok) emit('hafize:prompt-workflow-changed', { id, removed: true }); return ok;
  }
  function get(id) { return load().workflows.find((item) => item.id === id) || null; }
  function compile(id, variables = {}) {
    const workflow = get(id); if (!workflow) return null;
    const outputs = [];
    for (const step of workflow.steps) {
      const prompt = promptById(step.promptId); if (!prompt) return null;
      let body = core().replaceVariables(prompt.body, variables).slice(0, MAX_STEP_OUTPUT);
      outputs.push({ stepId: step.id, promptId: prompt.id, title: prompt.title, mode: step.mode, body, note: step.note });
    }
    return { workflow, outputs };
  }
  function compose(id, variables = {}) {
    const compiled = compile(id, variables); if (!compiled) return null;
    let output = '';
    for (const step of compiled.outputs) output = step.mode === 'append' && output ? `${output}\n\n${step.body}` : step.body;
    return { workflow: compiled.workflow, text: output.slice(0, 12000), steps: compiled.outputs.length };
  }
  function emit(type, detail) { try { root.dispatchEvent?.(new root.CustomEvent(type, { detail })); } catch {} }

  function button(doc, label, action) {
    const node = doc.createElement('button'); node.type = 'button'; node.className = 'mini-btn prompt-workflow-action'; node.textContent = label; node.dataset.workflowAction = action; node.setAttribute('aria-label', label); return node;
  }
  function status(message) { const node = root.document.querySelector('#promptLibraryCard .prompt-library-status'); if (node) node.textContent = clean(message, 180); }
  function selectedPromptIds(card) { return [...card.querySelectorAll('[data-prompt-selection]:checked')].map((node) => node.dataset.promptSelection).filter(Boolean).slice(0, MAX_SELECTED); }

  let mounted = false;
  function openManager() {
    root.document.getElementById('promptWorkflowManager')?.remove();
    const dialog = root.document.createElement('section'); dialog.id = 'promptWorkflowManager'; dialog.className = 'prompt-workflow-dialog'; dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-labelledby', 'promptWorkflowTitle');
    const shell = root.document.createElement('div'); shell.className = 'prompt-workflow-dialog-shell';
    const head = root.document.createElement('div'); head.className = 'prompt-workflow-dialog-head'; const title = root.document.createElement('strong'); title.id = 'promptWorkflowTitle'; title.textContent = 'Prompt workflow’ları'; const close = button(root.document, 'Kapat', 'close'); head.append(title, close);
    const createRow = root.document.createElement('div'); createRow.className = 'prompt-workflow-create'; const name = root.document.createElement('input'); name.maxLength = MAX_NAME; name.placeholder = 'Workflow adı'; name.setAttribute('aria-label', 'Workflow adı'); const add = button(root.document, 'Seçililerden oluştur', 'create'); createRow.append(name, add);
    const list = root.document.createElement('div'); list.className = 'prompt-workflow-list'; const info = root.document.createElement('div'); info.className = 'prompt-workflow-status'; info.setAttribute('role', 'status'); info.setAttribute('aria-live', 'polite'); shell.append(head, createRow, list, info); dialog.append(shell); root.document.body.append(dialog);
    function render() {
      list.replaceChildren();
      for (const item of load().workflows) {
        const row = root.document.createElement('article'); row.className = 'prompt-workflow-row';
        const strong = root.document.createElement('strong'); strong.textContent = item.name; const meta = root.document.createElement('span'); meta.textContent = `${item.steps.length} adım`;
        const run = button(root.document, 'Composer’a hazırla', 'run'); run.dataset.workflowId = item.id; const rename = button(root.document, 'Adlandır', 'rename'); rename.dataset.workflowId = item.id; const del = button(root.document, 'Sil', 'delete'); del.dataset.workflowId = item.id; row.append(strong, meta, run, rename, del); list.append(row);
      }
      if (!list.childElementCount) { const empty = root.document.createElement('p'); empty.textContent = 'Seçili istemleri işaretleyip yeni workflow oluşturabilirsin.'; list.append(empty); }
    }
    render(); close.focus?.();
    close.addEventListener('click', () => dialog.remove());
    add.addEventListener('click', () => { const ids = selectedPromptIds(root.document.getElementById(CARD_ID)); const item = create(name.value, ids); info.textContent = item ? `“${item.name}” oluşturuldu.` : 'Workflow oluşturulamadı. En az bir istem seçili olmalı.'; name.value = ''; render(); });
    list.addEventListener('click', (event) => {
      const target = event.target?.closest?.('[data-workflow-action]'); if (!target) return; const action = target.dataset.workflowAction; const id = target.dataset.workflowId;
      if (action === 'run') {
        const result = compose(id); const composer = root.document.getElementById('messageInput'); if (!result || !composer) return;
        composer.value = result.text; composer.dispatchEvent(new Event('input', { bubbles: true })); composer.focus(); status(`${result.steps} adımlı workflow composer’a hazırlandı.`); dialog.remove(); return;
      }
      if (action === 'rename') { const item = get(id); const next = root.prompt?.('Yeni workflow adı:', item?.name || ''); if (next !== null) info.textContent = update(id, { name: next }) ? 'Workflow adlandırıldı.' : 'Ad güncellenemedi.'; render(); return; }
      if (action === 'delete') { const item = get(id); if (item && root.confirm?.(`“${item.name}” silinsin mi?`)) info.textContent = remove(id) ? 'Workflow silindi.' : 'Workflow silinemedi.'; render(); }
    });
    dialog.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.preventDefault(); dialog.remove(); } });
  }
  function inject() {
    const card = root.document?.getElementById?.(CARD_ID); if (!card || card.querySelector('.prompt-workflow-toolbar')) return;
    const row = root.document.createElement('div'); row.className = 'prompt-workflow-toolbar'; const label = root.document.createElement('span'); label.textContent = 'Workflow'; label.className = 'prompt-workflow-label'; const manage = button(root.document, 'Yönet', 'manage'); const run = button(root.document, 'Son workflow', 'run-last'); row.append(label, manage, run); card.querySelector('.prompt-pack-toolbar, .prompt-workspace-toolbar, .prompt-collection-toolbar, .prompt-library-enhancement-toolbar, .prompt-library-filters')?.after(row);
    manage.addEventListener('click', openManager); run.addEventListener('click', () => { const data = load(); const item = data.activeId ? get(data.activeId) : data.workflows[0]; const result = item ? compose(item.id) : null; const composer = root.document.getElementById('messageInput'); if (!result || !composer) return status('Çalıştırılacak workflow yok.'); composer.value = result.text; composer.dispatchEvent(new Event('input', { bubbles: true })); composer.focus(); status(`${result.steps} adımlı workflow composer’a hazırlandı.`); });
  }
  function boot() { if (mounted || !root.document || !core()) return; if (!root.document.getElementById(CARD_ID)) return; mounted = true; new MutationObserver(inject).observe(root.document.getElementById(CARD_ID), { childList: true, subtree: true }); inject(); root.addEventListener?.('hafize:prompt-workflow-changed', inject); }
  root.HafizePromptLibraryWorkflows = Object.freeze({ STORAGE_KEY, MAX_WORKFLOWS, MAX_STEPS, load, save, create, update, remove, get, compile, compose });
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
