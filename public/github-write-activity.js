(function exposeHafizeGitHubWriteActivity(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) { module.exports = api; return; }
  root.HafizeGitHubWriteActivity = api;
  api.mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeGitHubWriteActivity() {
  'use strict';

  const REPOSITORY = 'umitalgan061-sudo/hafize';
  const MAX_ITEMS = 12;
  const MAX_BRANCH_CHARS = 120;
  const MAX_PATH_CHARS = 400;
  const MAX_PR_NUMBER = 10_000_000;
  const MOUNT_TIMEOUT_MS = 10_000;
  const BRANCH_PATTERN = /^hafize\/[A-Za-z0-9][A-Za-z0-9._/-]*$/;
  const PATH_PATTERN = /^[A-Za-z0-9._/-]+$/;
  const EVENT_NAMES = Object.freeze([
    'hafize:github-branch-created',
    'hafize:github-draft-pr-created',
    'hafize:github-file-updated'
  ]);

  function normalizeBranch(value) {
    const branch = typeof value === 'string' ? value.trim() : '';
    if (!branch || branch.length > MAX_BRANCH_CHARS || !BRANCH_PATTERN.test(branch)) return null;
    if (branch.includes('..') || branch.includes('//') || branch.endsWith('/')) return null;
    return branch;
  }

  function normalizePath(value) {
    const path = typeof value === 'string' ? value.trim() : '';
    if (!path || path.length > MAX_PATH_CHARS || !PATH_PATTERN.test(path)) return null;
    if (path.startsWith('/') || path.includes('..') || path.includes('//') || path.endsWith('/')) return null;
    return path;
  }

  function normalizePrNumber(value) {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < 1 || number > MAX_PR_NUMBER) return null;
    return number;
  }

  function normalizeEvent(type, detail, at = Date.now()) {
    if (!Number.isFinite(at) || at < 0 || !detail || typeof detail !== 'object' || Array.isArray(detail)) return null;
    if (type === 'hafize:github-branch-created') {
      const branch = normalizeBranch(detail.branch);
      if (!branch) return null;
      return Object.freeze({ kind: 'branch', branch, at });
    }
    if (type === 'hafize:github-draft-pr-created') {
      const prNumber = normalizePrNumber(detail.prNumber);
      if (!prNumber) return null;
      return Object.freeze({ kind: 'pr', prNumber, at });
    }
    if (type === 'hafize:github-file-updated') {
      const branch = normalizeBranch(detail.branch);
      const path = normalizePath(detail.path);
      if (!branch || !path) return null;
      return Object.freeze({ kind: 'file', branch, path, at });
    }
    return null;
  }

  function itemKey(item) {
    if (!item) return '';
    if (item.kind === 'branch') return `branch:${item.branch}`;
    if (item.kind === 'pr') return `pr:${item.prNumber}`;
    if (item.kind === 'file') return `file:${item.branch}:${item.path}`;
    return '';
  }

  function appendItem(items, item) {
    if (!Array.isArray(items) || !item || !itemKey(item)) return Array.isArray(items) ? [...items] : [];
    const key = itemKey(item);
    const next = items.filter((candidate) => itemKey(candidate) !== key);
    next.unshift(item);
    return next.slice(0, MAX_ITEMS);
  }

  function formatLabel(item) {
    if (item?.kind === 'branch') return `Branch oluşturuldu · ${item.branch}`;
    if (item?.kind === 'pr') return `Draft PR oluşturuldu · #${item.prNumber}`;
    if (item?.kind === 'file') return `Dosya güncellendi · ${item.path}`;
    return '';
  }

  function formatContext(item) {
    if (item?.kind === 'file') return item.branch;
    if (item?.kind === 'branch') return REPOSITORY;
    if (item?.kind === 'pr') return REPOSITORY;
    return '';
  }

  function formatTime(timestamp, locale = 'tr-TR') {
    if (!Number.isFinite(timestamp)) return '';
    try {
      return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(timestamp));
    } catch {
      return '';
    }
  }

  function createController({ documentRef = globalThis.document, rootRef = globalThis, now = () => Date.now() } = {}) {
    if (!documentRef?.querySelector || !documentRef?.createElement) throw new Error('INVALID_GITHUB_WRITE_ACTIVITY_DOCUMENT');
    if (!rootRef?.addEventListener || !rootRef?.removeEventListener || typeof now !== 'function') throw new Error('INVALID_GITHUB_WRITE_ACTIVITY_RUNTIME');

    let mounted = false;
    let host = null;
    let shell = null;
    let toggle = null;
    let panel = null;
    let list = null;
    let empty = null;
    let count = null;
    let clearButton = null;
    let status = null;
    let observer = null;
    let mountTimer = null;
    let items = [];

    function element(tag, className, text) {
      const node = documentRef.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined && text !== null) node.textContent = String(text);
      return node;
    }

    function render() {
      if (!list || !empty || !count || !clearButton) return;
      list.replaceChildren();
      count.textContent = String(items.length);
      clearButton.disabled = items.length === 0;
      empty.hidden = items.length !== 0;
      list.hidden = items.length === 0;

      for (const item of items) {
        const row = element('li', 'github-write-activity-item');
        row.dataset.kind = item.kind;
        const icon = element('span', 'github-write-activity-icon', item.kind === 'branch' ? '⑂' : item.kind === 'pr' ? '⑃' : '✎');
        icon.setAttribute('aria-hidden', 'true');
        const copy = element('div', 'github-write-activity-copy');
        const label = element('strong', '', formatLabel(item));
        const context = element('small', '', formatContext(item));
        const time = element('time', '', formatTime(item.at));
        if (Number.isFinite(item.at)) time.dateTime = new Date(item.at).toISOString();
        copy.append(label, context);
        row.append(icon, copy, time);
        list.append(row);
      }
    }

    function setStatus(text) {
      if (status) status.textContent = text;
    }

    function onWriteEvent(event) {
      const item = normalizeEvent(event?.type, event?.detail, now());
      if (!item) return false;
      items = appendItem(items, item);
      render();
      setStatus(`${formatLabel(item)}. Bu kayıt yalnız bu sayfa oturumunda tutulur.`);
      return true;
    }

    function clearItems() {
      if (!items.length) return false;
      items = [];
      render();
      setStatus('Oturum içi GitHub yazma etkinliği temizlendi.');
      return true;
    }

    function togglePanel() {
      if (!panel || !toggle) return;
      const open = panel.hidden;
      panel.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      if (open) clearButton?.focus?.();
    }

    function onKeydown(event) {
      if (event?.key !== 'Escape' || panel?.hidden) return;
      event.preventDefault?.();
      panel.hidden = true;
      toggle?.setAttribute?.('aria-expanded', 'false');
      toggle?.focus?.();
    }

    function build() {
      host = documentRef.querySelector('#githubWriteReadinessCard');
      if (!host || host.querySelector?.('[data-github-write-activity]')) return Boolean(host);

      shell = element('section', 'github-write-activity');
      shell.setAttribute('data-github-write-activity', '1');
      shell.setAttribute('aria-label', 'GitHub yazma etkinliği');

      toggle = element('button', 'mini-btn github-write-activity-toggle');
      toggle.type = 'button';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-controls', 'githubWriteActivityPanel');
      toggle.append(element('span', '', 'Geçmiş'), count = element('span', 'github-write-activity-count', '0'));

      panel = element('div', 'github-write-activity-panel');
      panel.id = 'githubWriteActivityPanel';
      panel.hidden = true;

      const head = element('div', 'github-write-activity-head');
      const titleWrap = element('div', 'github-write-activity-title');
      titleWrap.append(element('strong', '', 'Bu oturumdaki yazmalar'), element('small', '', 'Kalıcı log değildir. Token veya dosya içeriği tutulmaz.'));
      clearButton = element('button', 'mini-btn github-write-activity-clear', 'Temizle');
      clearButton.type = 'button';
      clearButton.disabled = true;
      head.append(titleWrap, clearButton);

      empty = element('p', 'github-write-activity-empty', 'Bu sayfa oturumunda tamamlanan GitHub yazma işlemi yok.');
      list = element('ol', 'github-write-activity-list');
      list.hidden = true;
      status = element('p', 'github-write-activity-status', 'Etkinlik yalnız başarılı ve doğrulanmış kullanıcı onaylı işlemlerden üretilir.');
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      status.setAttribute('aria-atomic', 'true');
      panel.append(head, empty, list, status);
      shell.append(toggle, panel);
      host.append(shell);
      render();
      return true;
    }

    function attach() {
      if (!build() || !toggle || !panel || !clearButton) return false;
      toggle.addEventListener?.('click', togglePanel);
      clearButton.addEventListener?.('click', clearItems);
      documentRef.addEventListener?.('keydown', onKeydown);
      for (const name of EVENT_NAMES) rootRef.addEventListener(name, onWriteEvent);
      mounted = true;
      return true;
    }

    function mount() {
      if (mounted) return false;
      if (attach()) return true;
      if (typeof rootRef.MutationObserver !== 'function' || !documentRef.body) return false;
      observer = new rootRef.MutationObserver(() => {
        if (!mounted && attach()) {
          observer?.disconnect?.();
          observer = null;
          if (mountTimer !== null) rootRef.clearTimeout?.(mountTimer);
          mountTimer = null;
        }
      });
      observer.observe(documentRef.body, { childList: true, subtree: true });
      mountTimer = rootRef.setTimeout?.(() => {
        observer?.disconnect?.();
        observer = null;
        mountTimer = null;
      }, MOUNT_TIMEOUT_MS) ?? null;
      return false;
    }

    function destroy() {
      observer?.disconnect?.();
      if (mountTimer !== null) rootRef.clearTimeout?.(mountTimer);
      mountTimer = null;
      observer = null;
      documentRef.removeEventListener?.('keydown', onKeydown);
      toggle?.removeEventListener?.('click', togglePanel);
      clearButton?.removeEventListener?.('click', clearItems);
      for (const name of EVENT_NAMES) rootRef.removeEventListener(name, onWriteEvent);
      shell?.remove?.();
      items = [];
      mounted = false;
    }

    return Object.freeze({
      mount,
      destroy,
      clearItems,
      getItems: () => Object.freeze(items.map((item) => Object.freeze({ ...item })))
    });
  }

  function mount() {
    try { return createController().mount(); } catch { return false; }
  }

  return Object.freeze({
    REPOSITORY,
    MAX_ITEMS,
    MAX_BRANCH_CHARS,
    MAX_PATH_CHARS,
    MAX_PR_NUMBER,
    MOUNT_TIMEOUT_MS,
    EVENT_NAMES,
    normalizeBranch,
    normalizePath,
    normalizePrNumber,
    normalizeEvent,
    itemKey,
    appendItem,
    formatLabel,
    formatContext,
    formatTime,
    createController,
    mount
  });
});
