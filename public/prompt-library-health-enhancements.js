(function installPromptLibraryHealthEnhancements(root) {
  'use strict';

  const PANEL_ID = 'promptLibraryHealth';
  const PROMPT_KEY = 'hafize.prompt-library.v1';
  const MAX_EXPORT = 900000;
  let ready = false;
  let observer = null;
  const disposers = [];

  const text = (doc, value) => {
    const node = doc.createElement('span');
    node.textContent = String(value ?? '');
    return node;
  };

  const button = (doc, label) => {
    const node = doc.createElement('button');
    node.type = 'button';
    node.className = 'mini-btn prompt-library-health-extra-btn';
    node.textContent = label;
    return node;
  };

  function storage(rootRef = root) {
    try { return rootRef.localStorage || null; } catch { return null; }
  }

  function readPrompts(rootRef = root) {
    const store = storage(rootRef);
    try {
      const value = JSON.parse(store?.getItem(PROMPT_KEY) || '[]');
      return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : [];
    } catch { return []; }
  }

  function healthApi(rootRef = root) {
    return rootRef.HafizePromptLibraryHealth || null;
  }

  function report(rootRef = root) {
    return healthApi(rootRef)?.diagnose?.(rootRef) || { summary: {}, issues: [], prompts: [] };
  }

  function safeFileName(value) {
    return String(value || 'rapor').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'rapor';
  }

  function download(rootRef, filename, content, type = 'application/json;charset=utf-8') {
    if (!content || content.length > MAX_EXPORT) return false;
    try {
      const blob = new Blob([content], { type });
      const url = rootRef.URL.createObjectURL(blob);
      const link = rootRef.document.createElement('a');
      link.href = url;
      link.download = filename;
      link.rel = 'noopener';
      link.click();
      rootRef.setTimeout?.(() => rootRef.URL.revokeObjectURL(url), 0);
      return true;
    } catch { return false; }
  }

  function reportPayload(rootRef = root) {
    const current = report(rootRef);
    return JSON.stringify({ ...current.summary, issues: current.issues }, null, 2).slice(0, MAX_EXPORT);
  }

  function problematicPrompts(rootRef = root) {
    const current = report(rootRef);
    const ids = new Set(current.issues.filter((issue) => ['error', 'warning'].includes(issue.severity) && issue.promptId).map((issue) => issue.promptId));
    return readPrompts(rootRef).filter((prompt) => ids.has(prompt.id)).slice(0, 120).map((prompt) => ({
      id: typeof prompt.id === 'string' ? prompt.id.slice(0, 120) : '',
      title: typeof prompt.title === 'string' ? prompt.title.slice(0, 100) : '',
      body: typeof prompt.body === 'string' ? prompt.body.slice(0, 8000) : '',
      tags: Array.isArray(prompt.tags) ? prompt.tags.filter((tag) => typeof tag === 'string').slice(0, 8) : [],
      issueCodes: current.issues.filter((issue) => issue.promptId === prompt.id && ['error', 'warning'].includes(issue.severity)).map((issue) => issue.code).slice(0, 12)
    }));
  }

  function statusMessage(rootRef, value) {
    const node = rootRef.document.querySelector(`#${PANEL_ID} .prompt-library-health-message`);
    if (node) node.textContent = String(value || '').slice(0, 180);
  }

  function appendControls(rootRef) {
    const panel = rootRef.document.getElementById(PANEL_ID);
    if (!panel || panel.querySelector('.prompt-library-health-extra-actions')) return;
    const body = panel.querySelector('.prompt-library-health-body');
    const actions = panel.querySelector('.prompt-library-health-actions');
    if (!body || !actions) return;

    const extra = rootRef.document.createElement('div');
    extra.className = 'prompt-library-health-extra-actions';
    const downloadReport = button(rootRef.document, 'Raporu indir');
    const downloadProblems = button(rootRef.document, 'Sorunlu promptları indir');
    const important = rootRef.document.createElement('label');
    important.className = 'prompt-library-health-important-toggle';
    const checkbox = rootRef.document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.setAttribute('aria-label', 'Yalnızca hata ve uyarıları göster');
    important.append(checkbox, text(rootRef.document, 'Yalnızca hata/uyarı'));
    extra.append(downloadReport, downloadProblems, important);
    body.insertBefore(extra, panel.querySelector('.prompt-library-health-stats'));

    const onReport = () => {
      const ok = download(rootRef, `hafize-prompt-health-${new Date().toISOString().slice(0, 10)}.json`, reportPayload(rootRef));
      statusMessage(rootRef, ok ? 'Sağlık raporu indirildi.' : 'Sağlık raporu indirilemedi.');
    };

    const onProblems = () => {
      const payload = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), prompts: problematicPrompts(rootRef) }, null, 2);
      const ok = download(rootRef, `hafize-prompt-problems-${new Date().toISOString().slice(0, 10)}.json`, payload);
      statusMessage(rootRef, ok ? 'Sorunlu promptlar indirildi.' : 'Sorunlu promptlar dışa aktarılamadı.');
    };

    const onImportant = () => {
      const rows = [...panel.querySelectorAll('.prompt-library-health-issue')];
      rows.forEach((row) => { row.hidden = checkbox.checked && row.classList.contains('is-info'); });
    };

    downloadReport.addEventListener('click', onReport);
    downloadProblems.addEventListener('click', onProblems);
    checkbox.addEventListener('change', onImportant);
    disposers.push(() => downloadReport.removeEventListener('click', onReport));
    disposers.push(() => downloadProblems.removeEventListener('click', onProblems));
    disposers.push(() => checkbox.removeEventListener('change', onImportant));
  }

  function boot(rootRef = root) {
    if (ready || !rootRef.document) return;
    const panel = rootRef.document.getElementById(PANEL_ID);
    if (!panel) return;
    ready = true;
    appendControls(rootRef);
    observer = typeof MutationObserver === 'function' ? new MutationObserver(() => {
      const current = rootRef.document.getElementById(PANEL_ID);
      if (current && !current.querySelector('.prompt-library-health-extra-actions')) appendControls(rootRef);
    }) : null;
    observer?.observe(panel, { childList: true, subtree: true });
    disposers.push(() => observer?.disconnect());
  }

  root.HafizePromptLibraryHealthEnhancements = Object.freeze({
    boot,
    report: () => report(root),
    problematicPrompts: () => problematicPrompts(root),
    downloadReport: () => download(root, `hafize-prompt-health-${Date.now()}.json`, reportPayload(root)),
    downloadProblems: () => download(root, `hafize-prompt-problems-${Date.now()}.json`, JSON.stringify({ version: 1, prompts: problematicPrompts(root) }, null, 2))
  });

  const start = () => boot(root);
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  root.addEventListener?.('beforeunload', () => { for (const dispose of disposers.splice(0)) dispose(); ready = false; observer = null; });
})(typeof globalThis !== 'undefined' ? globalThis : self);
