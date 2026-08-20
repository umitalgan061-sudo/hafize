(function exposeHafizeGitHubBranchCreate(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) { module.exports = api; return; }
  root.HafizeGitHubBranchCreate = api;
  api.mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeGitHubBranchCreate() {
  'use strict';

  const REPOSITORY = 'umitalgan061-sudo/hafize';
  const PREPARE_PATH = '/api/github/write/prepare';
  const EXECUTE_PATH = '/api/github/write/execute';
  const BRANCH_PREFIX = 'hafize/';
  const MAX_SUFFIX_CHARS = 90;
  const MAX_BASE_REF_CHARS = 120;
  const MAX_APPROVAL_TOKEN_CHARS = 2048;
  const MOUNT_TIMEOUT_MS = 10_000;
  const REQUEST_TIMEOUT_MS = 30_000;
  const SUFFIX_PATTERN = /^[a-z0-9][a-z0-9._/-]*$/;
  const REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
  const APPROVAL_TOKEN_PATTERN = /^gw1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/;
  const ACTIVE_CARDS = new WeakSet();

  function normalizeSuffix(value) {
    const suffix = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (!suffix || suffix.length > MAX_SUFFIX_CHARS || !SUFFIX_PATTERN.test(suffix)) return null;
    if (suffix.includes('..') || suffix.includes('//') || suffix.endsWith('/')) return null;
    return suffix;
  }

  function normalizeBaseRef(value) {
    const ref = typeof value === 'string' ? value.trim() : '';
    if (!ref || ref.length > MAX_BASE_REF_CHARS || !REF_PATTERN.test(ref)) return null;
    if (ref.includes('..') || ref.includes('//') || ref.endsWith('/')) return null;
    return ref;
  }

  function buildCommand({ suffix, baseRef } = {}) {
    const cleanSuffix = normalizeSuffix(suffix);
    const cleanBase = normalizeBaseRef(baseRef);
    if (!cleanSuffix || !cleanBase) return null;
    const branch = `${BRANCH_PREFIX}${cleanSuffix}`;
    if (branch === cleanBase) return null;
    return Object.freeze({ operation: 'branch.create', repository: REPOSITORY, branch, baseRef: cleanBase });
  }

  function sameCommand(left, right) {
    return Boolean(left && right
      && left.operation === 'branch.create'
      && right.operation === 'branch.create'
      && left.repository === REPOSITORY
      && right.repository === REPOSITORY
      && left.branch === right.branch
      && left.baseRef === right.baseRef
      && Object.keys(right).length === 4);
  }

  function normalizePrepared(value, expectedCommand, now = Date.now()) {
    if (!value || Array.isArray(value) || typeof value !== 'object') return null;
    if (!sameCommand(expectedCommand, value.command)) return null;
    const token = typeof value.approvalToken === 'string' ? value.approvalToken.trim() : '';
    if (!token || token.length > MAX_APPROVAL_TOKEN_CHARS || !APPROVAL_TOKEN_PATTERN.test(token)) return null;
    const expiry = Date.parse(value.expiresAt);
    if (!Number.isFinite(expiry) || expiry <= now || expiry > now + 5 * 60_000 + 5_000) return null;
    return Object.freeze({ command: Object.freeze({ ...value.command }), approvalToken: token, expiresAt: new Date(expiry).toISOString() });
  }

  function errorMessage(status) {
    if (status === 401) return 'GitHub yazma için güvenli Hafize oturumu gerekli.';
    if (status === 403) return 'Bu GitHub yazma işlemi izin politikasına takıldı.';
    if (status === 409) return 'Onay artık bu komutla eşleşmiyor. Yeniden hazırla.';
    if (status === 410) return 'GitHub yazma onayının süresi doldu. Yeniden hazırla.';
    if (status === 503) return 'GitHub yazma onay altyapısı şu anda kullanılamıyor.';
    if (status === 502) return 'GitHub işlemi güvenli yürütme sınırında başarısız oldu.';
    return 'GitHub branch işlemi tamamlanamadı.';
  }

  function requestError(code) {
    const error = new Error(code);
    error.name = 'AbortError';
    error.code = code;
    return error;
  }

  function createClient({
    fetchImpl = globalThis.fetch,
    AbortControllerImpl = globalThis.AbortController,
    setTimeoutImpl = globalThis.setTimeout,
    clearTimeoutImpl = globalThis.clearTimeout,
    timeoutMs = REQUEST_TIMEOUT_MS
  } = {}) {
    if (typeof fetchImpl !== 'function') throw new Error('INVALID_GITHUB_BRANCH_CREATE_FETCH');
    if (typeof AbortControllerImpl !== 'function') throw new Error('INVALID_GITHUB_BRANCH_CREATE_ABORT_CONTROLLER');
    if (typeof setTimeoutImpl !== 'function' || typeof clearTimeoutImpl !== 'function') throw new Error('INVALID_GITHUB_BRANCH_CREATE_TIMER');
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) throw new Error('INVALID_GITHUB_BRANCH_CREATE_TIMEOUT');

    return Object.freeze({
      async post(path, body, { signal } = {}) {
        if (path !== PREPARE_PATH && path !== EXECUTE_PATH) throw new Error('INVALID_GITHUB_BRANCH_CREATE_PATH');
        if (signal != null && (typeof signal !== 'object' || typeof signal.addEventListener !== 'function')) {
          throw new Error('INVALID_GITHUB_BRANCH_CREATE_SIGNAL');
        }
        if (signal?.aborted) throw requestError('GITHUB_BRANCH_CREATE_CANCELLED');

        const controller = new AbortControllerImpl();
        let timedOut = false;
        const onAbort = () => controller.abort(signal?.reason);
        signal?.addEventListener?.('abort', onAbort, { once: true });
        const timer = setTimeoutImpl(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs);

        try {
          const response = await fetchImpl(path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            credentials: 'same-origin',
            cache: 'no-store',
            body: JSON.stringify(body),
            signal: controller.signal
          });
          let payload = null;
          try { payload = await response.json(); } catch { payload = null; }
          return Object.freeze({ response, payload });
        } catch (error) {
          if (timedOut) throw requestError('GITHUB_BRANCH_CREATE_TIMEOUT');
          if (signal?.aborted) throw requestError('GITHUB_BRANCH_CREATE_CANCELLED');
          throw error;
        } finally {
          clearTimeoutImpl(timer);
          signal?.removeEventListener?.('abort', onAbort);
        }
      }
    });
  }

  function createController({
    documentRef = globalThis.document,
    rootRef = globalThis,
    fetchImpl = globalThis.fetch,
    now = () => Date.now(),
    timeoutMs = REQUEST_TIMEOUT_MS
  } = {}) {
    if (!documentRef?.querySelector || !documentRef?.createElement) throw new Error('INVALID_GITHUB_BRANCH_CREATE_DOCUMENT');
    if (typeof fetchImpl !== 'function' || typeof now !== 'function') throw new Error('INVALID_GITHUB_BRANCH_CREATE_RUNTIME');

    const client = createClient({
      fetchImpl,
      AbortControllerImpl: rootRef.AbortController,
      setTimeoutImpl: rootRef.setTimeout?.bind?.(rootRef),
      clearTimeoutImpl: rootRef.clearTimeout?.bind?.(rootRef),
      timeoutMs
    });

    let mounted = false;
    let destroyed = false;
    let card = null;
    let shell = null;
    let toggle = null;
    let form = null;
    let suffixInput = null;
    let baseInput = null;
    let prepareButton = null;
    let approveButton = null;
    let cancelButton = null;
    let status = null;
    let summary = null;
    let prepared = null;
    let activeRequest = null;
    let requestGeneration = 0;
    let observer = null;
    let mountTimer = null;
    const listenerCleanup = [];

    function element(tag, className, text) {
      const node = documentRef.createElement(tag);
      if (className) node.className = className;
      if (text) node.textContent = text;
      return node;
    }

    function clearPrepared({ announce = false } = {}) {
      prepared = null;
      if (approveButton) approveButton.hidden = true;
      if (summary) { summary.hidden = true; summary.textContent = ''; }
      if (announce) setStatus('Değişiklik algılandı; önce yeni onay hazırlanmalı.', 'idle');
    }

    function setStatus(text, state = 'idle') {
      if (destroyed || !status) return;
      status.textContent = text;
      status.dataset.state = state;
    }

    function setBusy(busy) {
      if (destroyed) return;
      card?.setAttribute?.('aria-busy', String(Boolean(busy)));
      if (prepareButton) prepareButton.disabled = Boolean(busy);
      if (approveButton) approveButton.disabled = Boolean(busy);
      if (cancelButton) cancelButton.disabled = Boolean(busy);
      if (suffixInput) suffixInput.disabled = Boolean(busy);
      if (baseInput) baseInput.disabled = Boolean(busy);
    }

    function addListener(target, type, listener) {
      if (typeof target?.addEventListener !== 'function' || typeof target?.removeEventListener !== 'function') {
        throw new Error('INVALID_GITHUB_BRANCH_CREATE_LISTENER_TARGET');
      }
      target.addEventListener(type, listener);
      listenerCleanup.push(() => target.removeEventListener(type, listener));
    }

    function stopWaiting() {
      observer?.disconnect?.();
      observer = null;
      if (mountTimer !== null) rootRef.clearTimeout?.(mountTimer);
      mountTimer = null;
    }

    function abortActive(reason = 'github-branch-create-cancelled') {
      activeRequest?.controller?.abort?.(reason);
      activeRequest = null;
    }

    function beginRequest() {
      abortActive('github-branch-create-superseded');
      const controller = new rootRef.AbortController();
      const request = Object.freeze({ id: ++requestGeneration, controller });
      activeRequest = request;
      return request;
    }

    function isCurrent(request) {
      return !destroyed && mounted && activeRequest === request;
    }

    function build() {
      card = documentRef.querySelector('#githubWriteReadinessCard');
      if (!card || ACTIVE_CARDS.has(card) || card.querySelector?.('[data-github-branch-create]')) return false;

      shell = element('div', 'github-branch-create');
      shell.setAttribute('data-github-branch-create', '1');
      toggle = element('button', 'mini-btn github-branch-create-toggle', '＋ Branch');
      toggle.type = 'button';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-controls', 'githubBranchCreateForm');
      form = element('form', 'github-branch-create-form');
      form.id = 'githubBranchCreateForm';
      form.hidden = true;
      form.noValidate = true;

      const repo = element('p', 'github-branch-create-repo', REPOSITORY);
      repo.setAttribute('aria-label', 'Hedef GitHub deposu');
      const suffixLabel = element('label', 'github-branch-create-label');
      suffixLabel.append(element('span', '', 'Branch adı'));
      const suffixRow = element('div', 'github-branch-create-input-row');
      const prefix = element('span', 'github-branch-create-prefix', BRANCH_PREFIX);
      prefix.setAttribute('aria-hidden', 'true');
      suffixInput = element('input', 'github-branch-create-input');
      suffixInput.type = 'text';
      suffixInput.maxLength = MAX_SUFFIX_CHARS;
      suffixInput.autocomplete = 'off';
      suffixInput.spellcheck = false;
      suffixInput.placeholder = 'ozellik-adi';
      suffixInput.setAttribute('aria-label', `Branch adı; ${BRANCH_PREFIX} öneki otomatik eklenir`);
      suffixRow.append(prefix, suffixInput);
      suffixLabel.append(suffixRow);

      const baseLabel = element('label', 'github-branch-create-label');
      baseLabel.append(element('span', '', 'Base ref'));
      baseInput = element('input', 'github-branch-create-input');
      baseInput.type = 'text';
      baseInput.maxLength = MAX_BASE_REF_CHARS;
      baseInput.autocomplete = 'off';
      baseInput.spellcheck = false;
      baseInput.value = 'main';
      baseInput.setAttribute('aria-label', 'Branch için base ref');
      baseLabel.append(baseInput);

      summary = element('p', 'github-branch-create-summary');
      summary.hidden = true;
      summary.setAttribute('role', 'status');
      status = element('p', 'github-branch-create-status', 'Branch oluşturma yalnız iki aşamalı açık onayla çalışır.');
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      status.setAttribute('aria-atomic', 'true');

      const actions = element('div', 'github-branch-create-actions');
      prepareButton = element('button', 'github-branch-create-primary', 'Onayı hazırla');
      prepareButton.type = 'submit';
      approveButton = element('button', 'github-branch-create-primary github-branch-create-approve', 'Onayla ve oluştur');
      approveButton.type = 'button';
      approveButton.hidden = true;
      cancelButton = element('button', 'mini-btn github-branch-create-cancel', 'Kapat');
      cancelButton.type = 'button';
      actions.append(prepareButton, approveButton, cancelButton);
      form.append(repo, suffixLabel, baseLabel, summary, status, actions);
      shell.append(toggle, form);
      card.append(shell);
      return true;
    }

    function openForm() {
      if (destroyed || !form) return false;
      form.hidden = false;
      toggle?.setAttribute?.('aria-expanded', 'true');
      suffixInput?.focus?.();
      return true;
    }

    function closeForm() {
      if (destroyed || !form) return false;
      abortActive('github-branch-create-closed');
      setBusy(false);
      clearPrepared();
      form.hidden = true;
      toggle?.setAttribute?.('aria-expanded', 'false');
      setStatus('Branch oluşturma yalnız iki aşamalı açık onayla çalışır.', 'idle');
      toggle?.focus?.();
      return true;
    }

    function currentCommand() {
      return destroyed ? null : buildCommand({ suffix: suffixInput?.value, baseRef: baseInput?.value });
    }

    async function prepare(event) {
      event?.preventDefault?.();
      if (destroyed || !mounted) return false;
      const command = currentCommand();
      clearPrepared();
      if (!command) {
        setStatus(`Geçerli bir ${BRANCH_PREFIX} branch adı ve base ref gir.`, 'error');
        suffixInput?.focus?.();
        return false;
      }
      let request;
      try { request = beginRequest(); }
      catch { setStatus('GitHub onay isteği başlatılamadı.', 'error'); return false; }
      setBusy(true);
      setStatus('GitHub branch komutu güvenli onay sınırında hazırlanıyor…', 'loading');
      try {
        const { response, payload } = await client.post(PREPARE_PATH, { command }, { signal: request.controller.signal });
        if (!isCurrent(request)) return false;
        if (!response?.ok) { setStatus(errorMessage(response?.status), 'error'); return false; }
        const next = normalizePrepared(payload, command, now());
        if (!next) { setStatus('Sunucudan geçerli ve eşleşen bir onay alınamadı.', 'error'); return false; }
        prepared = next;
        summary.textContent = `${next.command.branch} ← ${next.command.baseRef}`;
        summary.hidden = false;
        approveButton.hidden = false;
        setStatus('Onay hazır. Branch yalnız aşağıdaki ikinci düğmeye basarsan oluşturulacak.', 'ready');
        approveButton.focus?.();
        return true;
      } catch (error) {
        if (!isCurrent(request)) return false;
        if (error?.code === 'GITHUB_BRANCH_CREATE_TIMEOUT') setStatus('GitHub onayı zaman aşımına uğradı. Tekrar deneyebilirsin.', 'error');
        else if (error?.code !== 'GITHUB_BRANCH_CREATE_CANCELLED') setStatus('GitHub onayı hazırlanırken bağlantı hatası oluştu.', 'error');
        return false;
      } finally {
        if (activeRequest === request) {
          activeRequest = null;
          setBusy(false);
        }
      }
    }

    async function execute() {
      if (destroyed || !mounted) return false;
      if (!prepared) { setStatus('Önce bu exact branch komutu için onay hazırla.', 'error'); return false; }
      const live = currentCommand();
      if (!sameCommand(prepared.command, live)) {
        clearPrepared();
        setStatus('Branch bilgileri değişti; eski onay kullanılmadı.', 'error');
        return false;
      }
      if (Date.parse(prepared.expiresAt) <= now()) {
        clearPrepared();
        setStatus('Onayın süresi doldu; yeniden hazırla.', 'error');
        return false;
      }
      const snapshot = prepared;
      let request;
      try { request = beginRequest(); }
      catch { setStatus('GitHub branch isteği başlatılamadı.', 'error'); return false; }
      setBusy(true);
      setStatus('Açık onayla GitHub branch oluşturuluyor…', 'loading');
      try {
        const { response, payload } = await client.post(EXECUTE_PATH, { command: snapshot.command, approvalToken: snapshot.approvalToken }, { signal: request.controller.signal });
        if (!isCurrent(request)) return false;
        clearPrepared();
        if (!response?.ok) { setStatus(errorMessage(response?.status), 'error'); return false; }
        if (!payload || typeof payload !== 'object' || !payload.receipt) {
          setStatus('GitHub sonucu doğrulanamadı.', 'error');
          return false;
        }
        suffixInput.value = '';
        setStatus(`Branch oluşturuldu: ${snapshot.command.branch}`, 'success');
        return true;
      } catch (error) {
        if (!isCurrent(request)) return false;
        clearPrepared();
        if (error?.code === 'GITHUB_BRANCH_CREATE_TIMEOUT') setStatus('GitHub branch oluşturma isteği zaman aşımına uğradı. Yeniden onay hazırla.', 'error');
        else if (error?.code !== 'GITHUB_BRANCH_CREATE_CANCELLED') setStatus('GitHub branch oluşturulurken bağlantı hatası oluştu.', 'error');
        return false;
      } finally {
        if (activeRequest === request) {
          activeRequest = null;
          setBusy(false);
        }
      }
    }

    function onToggle() { if (form?.hidden) openForm(); else closeForm(); }
    function onInput() { if (!destroyed && prepared) clearPrepared({ announce: true }); }
    function onKeydown(event) {
      if (destroyed || event?.key !== 'Escape' || form?.hidden || card?.getAttribute?.('aria-busy') === 'true') return;
      event.preventDefault?.();
      closeForm();
    }

    function attach() {
      if (destroyed || mounted || !build() || !toggle || !form) return false;
      ACTIVE_CARDS.add(card);
      try {
        addListener(toggle, 'click', onToggle);
        addListener(form, 'submit', prepare);
        addListener(approveButton, 'click', execute);
        addListener(cancelButton, 'click', closeForm);
        addListener(suffixInput, 'input', onInput);
        addListener(baseInput, 'input', onInput);
        addListener(documentRef, 'keydown', onKeydown);
        mounted = true;
        return true;
      } catch {
        while (listenerCleanup.length) { try { listenerCleanup.pop()(); } catch {} }
        shell?.remove?.();
        shell = null;
        ACTIVE_CARDS.delete(card);
        return false;
      }
    }

    function mountController() {
      if (destroyed || mounted) return false;
      if (attach()) return true;
      if (typeof rootRef.MutationObserver !== 'function' || !documentRef.body) return false;
      try {
        observer = new rootRef.MutationObserver(() => {
          if (!destroyed && !mounted && attach()) stopWaiting();
        });
        observer.observe(documentRef.body, { childList: true, subtree: true });
        mountTimer = rootRef.setTimeout?.(stopWaiting, MOUNT_TIMEOUT_MS) ?? null;
      } catch {
        stopWaiting();
        return false;
      }
      return false;
    }

    function destroy() {
      if (destroyed) return false;
      destroyed = true;
      abortActive('github-branch-create-destroyed');
      stopWaiting();
      while (listenerCleanup.length) { try { listenerCleanup.pop()(); } catch {} }
      shell?.remove?.();
      if (card) ACTIVE_CARDS.delete(card);
      prepared = null;
      mounted = false;
      shell = null;
      return true;
    }

    return Object.freeze({
      mount: mountController,
      destroy,
      prepare,
      execute,
      currentCommand,
      getState: () => Object.freeze({ mounted, destroyed, busy: Boolean(activeRequest), prepared: Boolean(prepared) })
    });
  }

  function mount(options) {
    try {
      const controller = createController(options);
      controller.mount();
      return controller;
    } catch { return null; }
  }

  return Object.freeze({
    REPOSITORY,
    PREPARE_PATH,
    EXECUTE_PATH,
    BRANCH_PREFIX,
    MAX_SUFFIX_CHARS,
    MAX_BASE_REF_CHARS,
    MAX_APPROVAL_TOKEN_CHARS,
    MOUNT_TIMEOUT_MS,
    REQUEST_TIMEOUT_MS,
    normalizeSuffix,
    normalizeBaseRef,
    buildCommand,
    sameCommand,
    normalizePrepared,
    errorMessage,
    createClient,
    createController,
    mount
  });
});
