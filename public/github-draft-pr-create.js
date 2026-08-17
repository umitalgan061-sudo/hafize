(function exposeHafizeGitHubDraftPrCreate(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) { module.exports = api; return; }
  root.HafizeGitHubDraftPrCreate = api;
  api.mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeGitHubDraftPrCreate() {
  'use strict';

  const REPOSITORY = 'umitalgan061-sudo/hafize';
  const PREPARE_PATH = '/api/github/write/prepare';
  const EXECUTE_PATH = '/api/github/write/execute';
  const BRANCH_PREFIX = 'hafize/';
  const MAX_HEAD_SUFFIX_CHARS = 90;
  const MAX_BASE_REF_CHARS = 120;
  const MAX_TITLE_CHARS = 180;
  const MAX_APPROVAL_TOKEN_CHARS = 2048;
  const MOUNT_TIMEOUT_MS = 10_000;
  const SUFFIX_PATTERN = /^[a-z0-9][a-z0-9._/-]*$/;
  const REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
  const APPROVAL_TOKEN_PATTERN = /^gw1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/;
  const CONTROL_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

  function normalizeHeadSuffix(value) {
    const suffix = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (!suffix || suffix.length > MAX_HEAD_SUFFIX_CHARS || !SUFFIX_PATTERN.test(suffix)) return null;
    if (suffix.includes('..') || suffix.includes('//') || suffix.endsWith('/')) return null;
    return suffix;
  }

  function normalizeBaseRef(value) {
    const ref = typeof value === 'string' ? value.trim() : '';
    if (!ref || ref.length > MAX_BASE_REF_CHARS || !REF_PATTERN.test(ref)) return null;
    if (ref.includes('..') || ref.includes('//') || ref.endsWith('/')) return null;
    return ref;
  }

  function normalizeTitle(value) {
    const title = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
    if (!title || title.length > MAX_TITLE_CHARS || CONTROL_PATTERN.test(title)) return null;
    return title;
  }

  function buildCommand({ headSuffix, baseRef, title } = {}) {
    const suffix = normalizeHeadSuffix(headSuffix);
    const base = normalizeBaseRef(baseRef);
    const cleanTitle = normalizeTitle(title);
    if (!suffix || !base || !cleanTitle) return null;
    const head = `${BRANCH_PREFIX}${suffix}`;
    if (head === base) return null;
    return Object.freeze({ operation: 'pr.create', repository: REPOSITORY, head, base, title: cleanTitle, draft: true });
  }

  function sameCommand(left, right) {
    return Boolean(left && right
      && left.operation === 'pr.create'
      && right.operation === 'pr.create'
      && left.repository === REPOSITORY
      && right.repository === REPOSITORY
      && left.head === right.head
      && left.base === right.base
      && left.title === right.title
      && left.draft === true
      && right.draft === true
      && Object.keys(right).length === 6);
  }

  function normalizePrepared(value, expectedCommand, now = Date.now()) {
    if (!value || Array.isArray(value) || typeof value !== 'object') return null;
    if (!sameCommand(expectedCommand, value.command)) return null;
    const token = typeof value.approvalToken === 'string' ? value.approvalToken.trim() : '';
    if (!token || token.length > MAX_APPROVAL_TOKEN_CHARS || !APPROVAL_TOKEN_PATTERN.test(token)) return null;
    const expiry = Date.parse(value.expiresAt);
    if (!Number.isFinite(expiry) || expiry <= now || expiry > now + 5 * 60_000 + 5_000) return null;
    return Object.freeze({
      command: Object.freeze({ ...value.command }),
      approvalToken: token,
      expiresAt: new Date(expiry).toISOString()
    });
  }

  function normalizeReceipt(value) {
    if (!value || Array.isArray(value) || typeof value !== 'object') return null;
    const receipt = value.receipt;
    if (!receipt || Array.isArray(receipt) || typeof receipt !== 'object') return null;
    const operation = receipt.operation;
    const repository = receipt.repository;
    if (operation !== 'pr.create' || repository !== REPOSITORY) return null;
    const prNumber = receipt.prNumber;
    if (!Number.isInteger(prNumber) || prNumber < 1) return null;
    return Object.freeze({ prNumber });
  }

  function errorMessage(status) {
    if (status === 401) return 'GitHub yazma için güvenli Hafize oturumu gerekli.';
    if (status === 403) return 'Bu draft PR işlemi izin politikasına takıldı.';
    if (status === 409) return 'Onay artık bu PR komutuyla eşleşmiyor. Yeniden hazırla.';
    if (status === 410) return 'GitHub yazma onayının süresi doldu. Yeniden hazırla.';
    if (status === 422) return 'GitHub bu draft PR isteğini kabul etmedi. Branch ve base bilgisini kontrol et.';
    if (status === 503) return 'GitHub yazma onay altyapısı şu anda kullanılamıyor.';
    if (status === 502) return 'GitHub draft PR işlemi güvenli yürütme sınırında başarısız oldu.';
    return 'GitHub draft PR işlemi tamamlanamadı.';
  }

  function createController({
    documentRef = globalThis.document,
    rootRef = globalThis,
    fetchImpl = globalThis.fetch,
    now = () => Date.now()
  } = {}) {
    if (!documentRef?.querySelector || !documentRef?.createElement) throw new Error('INVALID_GITHUB_DRAFT_PR_DOCUMENT');
    if (typeof fetchImpl !== 'function' || typeof now !== 'function') throw new Error('INVALID_GITHUB_DRAFT_PR_RUNTIME');

    let mounted = false;
    let card = null;
    let toggle = null;
    let form = null;
    let headInput = null;
    let baseInput = null;
    let titleInput = null;
    let prepareButton = null;
    let approveButton = null;
    let cancelButton = null;
    let status = null;
    let summary = null;
    let prepared = null;
    let requestController = null;
    let observer = null;
    let mountTimer = null;

    function element(tag, className, text) {
      const node = documentRef.createElement(tag);
      if (className) node.className = className;
      if (text) node.textContent = text;
      return node;
    }

    function setStatus(text, state = 'idle') {
      if (!status) return;
      status.textContent = text;
      status.dataset.state = state;
    }

    function clearPrepared({ announce = false } = {}) {
      prepared = null;
      if (approveButton) approveButton.hidden = true;
      if (summary) { summary.hidden = true; summary.textContent = ''; }
      if (announce) setStatus('PR bilgileri değişti; önce yeni onay hazırlanmalı.', 'idle');
    }

    function setBusy(busy) {
      card?.setAttribute?.('aria-busy', String(Boolean(busy)));
      for (const control of [prepareButton, approveButton, cancelButton, headInput, baseInput, titleInput]) {
        if (control) control.disabled = Boolean(busy);
      }
    }

    function build() {
      card = documentRef.querySelector('#githubWriteReadinessCard');
      if (!card || card.querySelector?.('[data-github-draft-pr-create]')) return Boolean(card);

      const shell = element('div', 'github-draft-pr-create');
      shell.setAttribute('data-github-draft-pr-create', '1');

      toggle = element('button', 'mini-btn github-draft-pr-toggle', '＋ Draft PR');
      toggle.type = 'button';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-controls', 'githubDraftPrCreateForm');

      form = element('form', 'github-draft-pr-form');
      form.id = 'githubDraftPrCreateForm';
      form.hidden = true;
      form.noValidate = true;

      const repo = element('p', 'github-draft-pr-repo', REPOSITORY);
      repo.setAttribute('aria-label', 'Hedef GitHub deposu');

      const headLabel = element('label', 'github-draft-pr-label');
      headLabel.append(element('span', '', 'Head branch'));
      const headRow = element('div', 'github-draft-pr-input-row');
      const prefix = element('span', 'github-draft-pr-prefix', BRANCH_PREFIX);
      prefix.setAttribute('aria-hidden', 'true');
      headInput = element('input', 'github-draft-pr-input');
      headInput.type = 'text';
      headInput.maxLength = MAX_HEAD_SUFFIX_CHARS;
      headInput.autocomplete = 'off';
      headInput.spellcheck = false;
      headInput.placeholder = 'ozellik-branch';
      headInput.setAttribute('aria-label', `PR head branch; ${BRANCH_PREFIX} öneki otomatik eklenir`);
      headRow.append(prefix, headInput);
      headLabel.append(headRow);

      const baseLabel = element('label', 'github-draft-pr-label');
      baseLabel.append(element('span', '', 'Base branch'));
      baseInput = element('input', 'github-draft-pr-input');
      baseInput.type = 'text';
      baseInput.maxLength = MAX_BASE_REF_CHARS;
      baseInput.autocomplete = 'off';
      baseInput.spellcheck = false;
      baseInput.value = 'main';
      baseInput.setAttribute('aria-label', 'PR base branch');
      baseLabel.append(baseInput);

      const titleLabel = element('label', 'github-draft-pr-label');
      titleLabel.append(element('span', '', 'PR başlığı'));
      titleInput = element('input', 'github-draft-pr-input');
      titleInput.type = 'text';
      titleInput.maxLength = MAX_TITLE_CHARS;
      titleInput.autocomplete = 'off';
      titleInput.placeholder = 'feat: güvenli iyileştirme';
      titleInput.setAttribute('aria-label', 'Draft Pull Request başlığı');
      titleLabel.append(titleInput);

      summary = element('p', 'github-draft-pr-summary');
      summary.hidden = true;
      summary.setAttribute('role', 'status');

      status = element('p', 'github-draft-pr-status', 'Draft PR yalnız iki aşamalı açık onayla oluşturulur.');
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      status.setAttribute('aria-atomic', 'true');

      const actions = element('div', 'github-draft-pr-actions');
      prepareButton = element('button', 'github-draft-pr-primary', 'Onayı hazırla');
      prepareButton.type = 'submit';
      approveButton = element('button', 'github-draft-pr-primary github-draft-pr-approve', 'Onayla ve draft PR aç');
      approveButton.type = 'button';
      approveButton.hidden = true;
      cancelButton = element('button', 'mini-btn github-draft-pr-cancel', 'Kapat');
      cancelButton.type = 'button';
      actions.append(prepareButton, approveButton, cancelButton);

      form.append(repo, headLabel, baseLabel, titleLabel, summary, status, actions);
      shell.append(toggle, form);
      card.append(shell);
      return true;
    }

    function openForm() {
      if (!form) return;
      form.hidden = false;
      toggle?.setAttribute?.('aria-expanded', 'true');
      headInput?.focus?.();
    }

    function closeForm() {
      if (!form) return;
      requestController?.abort?.();
      setBusy(false);
      clearPrepared();
      form.hidden = true;
      toggle?.setAttribute?.('aria-expanded', 'false');
      setStatus('Draft PR yalnız iki aşamalı açık onayla oluşturulur.', 'idle');
      toggle?.focus?.();
    }

    function currentCommand() {
      return buildCommand({ headSuffix: headInput?.value, baseRef: baseInput?.value, title: titleInput?.value });
    }

    async function postJson(path, body) {
      requestController?.abort?.();
      requestController = typeof rootRef.AbortController === 'function' ? new rootRef.AbortController() : null;
      const response = await fetchImpl(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify(body),
        ...(requestController ? { signal: requestController.signal } : {})
      });
      let payload = null;
      try { payload = await response.json(); } catch { payload = null; }
      return { response, payload };
    }

    async function prepare(event) {
      event?.preventDefault?.();
      const command = currentCommand();
      clearPrepared();
      if (!command) {
        setStatus('Geçerli hafize/ head branch, base branch ve PR başlığı gir.', 'error');
        headInput?.focus?.();
        return false;
      }
      setBusy(true);
      setStatus('Draft PR komutu güvenli onay sınırında hazırlanıyor…', 'loading');
      try {
        const { response, payload } = await postJson(PREPARE_PATH, { command });
        if (!response?.ok) { setStatus(errorMessage(response?.status), 'error'); return false; }
        const next = normalizePrepared(payload, command, now());
        if (!next) { setStatus('Sunucudan geçerli ve eşleşen bir onay alınamadı.', 'error'); return false; }
        prepared = next;
        summary.textContent = `${next.command.head} → ${next.command.base} · ${next.command.title}`;
        summary.hidden = false;
        approveButton.hidden = false;
        setStatus('Onay hazır. Draft PR yalnız ikinci düğmeye basarsan oluşturulacak.', 'ready');
        approveButton.focus?.();
        return true;
      } catch (error) {
        if (error?.name !== 'AbortError') setStatus('GitHub onayı hazırlanırken bağlantı hatası oluştu.', 'error');
        return false;
      } finally {
        setBusy(false);
      }
    }

    async function execute() {
      if (!prepared) { setStatus('Önce bu exact draft PR komutu için onay hazırla.', 'error'); return false; }
      const live = currentCommand();
      if (!sameCommand(prepared.command, live)) {
        clearPrepared();
        setStatus('PR bilgileri değişti; eski onay kullanılmadı.', 'error');
        return false;
      }
      if (Date.parse(prepared.expiresAt) <= now()) {
        clearPrepared();
        setStatus('Onayın süresi doldu; yeniden hazırla.', 'error');
        return false;
      }
      const snapshot = prepared;
      setBusy(true);
      setStatus('Açık onayla draft Pull Request oluşturuluyor…', 'loading');
      try {
        const { response, payload } = await postJson(EXECUTE_PATH, { command: snapshot.command, approvalToken: snapshot.approvalToken });
        clearPrepared();
        if (!response?.ok) { setStatus(errorMessage(response?.status), 'error'); return false; }
        const receipt = normalizeReceipt(payload);
        if (!receipt) { setStatus('GitHub draft PR sonucu doğrulanamadı.', 'error'); return false; }
        headInput.value = '';
        titleInput.value = '';
        setStatus(`Draft PR #${receipt.prNumber} oluşturuldu.`, 'success');
        rootRef.dispatchEvent?.(new rootRef.CustomEvent('hafize:github-draft-pr-created', {
          detail: Object.freeze({ prNumber: receipt.prNumber })
        }));
        return true;
      } catch (error) {
        clearPrepared();
        if (error?.name !== 'AbortError') setStatus('GitHub draft PR oluşturulurken bağlantı hatası oluştu.', 'error');
        return false;
      } finally {
        setBusy(false);
      }
    }

    function onToggle() { if (form?.hidden) openForm(); else closeForm(); }
    function onInput() { if (prepared) clearPrepared({ announce: true }); }
    function onKeydown(event) {
      if (event?.key !== 'Escape' || form?.hidden || card?.getAttribute?.('aria-busy') === 'true') return;
      event.preventDefault?.();
      closeForm();
    }

    function attach() {
      if (!build() || !toggle || !form) return false;
      toggle.addEventListener?.('click', onToggle);
      form.addEventListener?.('submit', prepare);
      approveButton.addEventListener?.('click', execute);
      cancelButton.addEventListener?.('click', closeForm);
      headInput.addEventListener?.('input', onInput);
      baseInput.addEventListener?.('input', onInput);
      titleInput.addEventListener?.('input', onInput);
      documentRef.addEventListener?.('keydown', onKeydown);
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
      requestController?.abort?.();
      observer?.disconnect?.();
      if (mountTimer !== null) rootRef.clearTimeout?.(mountTimer);
      documentRef.removeEventListener?.('keydown', onKeydown);
      toggle?.removeEventListener?.('click', onToggle);
      form?.removeEventListener?.('submit', prepare);
      approveButton?.removeEventListener?.('click', execute);
      cancelButton?.removeEventListener?.('click', closeForm);
      headInput?.removeEventListener?.('input', onInput);
      baseInput?.removeEventListener?.('input', onInput);
      titleInput?.removeEventListener?.('input', onInput);
      card?.querySelector?.('[data-github-draft-pr-create]')?.remove?.();
      mounted = false;
      prepared = null;
      observer = null;
      mountTimer = null;
    }

    return Object.freeze({ mount, destroy, prepare, execute, currentCommand });
  }

  const singleton = { controller: null };
  function mount(options) {
    if (!singleton.controller) singleton.controller = createController(options);
    return singleton.controller.mount();
  }

  return Object.freeze({
    REPOSITORY,
    PREPARE_PATH,
    EXECUTE_PATH,
    BRANCH_PREFIX,
    MAX_HEAD_SUFFIX_CHARS,
    MAX_BASE_REF_CHARS,
    MAX_TITLE_CHARS,
    normalizeHeadSuffix,
    normalizeBaseRef,
    normalizeTitle,
    buildCommand,
    sameCommand,
    normalizePrepared,
    normalizeReceipt,
    errorMessage,
    createController,
    mount
  });
});
