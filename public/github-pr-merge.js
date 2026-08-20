(function exposeHafizeGitHubPrMerge(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) { module.exports = api; return; }
  root.HafizeGitHubPrMerge = api;
  api.mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeGitHubPrMerge() {
  'use strict';

  const REPOSITORY = 'umitalgan061-sudo/hafize';
  const PREPARE_PATH = '/api/github/write/prepare';
  const EXECUTE_PATH = '/api/github/write/execute';
  const MAX_PR_NUMBER = 2_147_483_647;
  const MAX_APPROVAL_TOKEN_CHARS = 2048;
  const MOUNT_TIMEOUT_MS = 10_000;
  const REQUEST_TIMEOUT_MS = 30_000;
  const SHA_PATTERN = /^[a-f0-9]{40}$/;
  const APPROVAL_TOKEN_PATTERN = /^gw1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/;
  const ACTIVE_CARDS = new WeakSet();

  function normalizePrNumber(value) {
    const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
    if (!/^\d{1,10}$/.test(text)) return null;
    const number = Number(text);
    if (!Number.isSafeInteger(number) || number < 1 || number > MAX_PR_NUMBER) return null;
    return number;
  }

  function normalizeHeadSha(value) {
    const sha = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return SHA_PATTERN.test(sha) ? sha : null;
  }

  function buildCommand({ prNumber, expectedHeadSha } = {}) {
    const number = normalizePrNumber(prNumber);
    const sha = normalizeHeadSha(expectedHeadSha);
    if (!number || !sha) return null;
    return Object.freeze({ operation: 'pr.merge', repository: REPOSITORY, prNumber: number, expectedHeadSha: sha });
  }

  function sameCommand(left, right) {
    return Boolean(left && right
      && left.operation === 'pr.merge'
      && right.operation === 'pr.merge'
      && left.repository === REPOSITORY
      && right.repository === REPOSITORY
      && left.prNumber === right.prNumber
      && left.expectedHeadSha === right.expectedHeadSha
      && Object.keys(right).length === 4);
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

  function normalizeReceipt(value, expectedCommand) {
    if (!value || Array.isArray(value) || typeof value !== 'object') return null;
    const receipt = value.receipt;
    if (!receipt || Array.isArray(receipt) || typeof receipt !== 'object') return null;
    if (receipt.operation !== 'pr.merge' || receipt.repository !== REPOSITORY) return null;
    if (receipt.prNumber !== expectedCommand?.prNumber || receipt.merged !== true) return null;
    const sha = normalizeHeadSha(receipt.sha);
    if (!sha) return null;
    return Object.freeze({ prNumber: receipt.prNumber, sha });
  }

  function errorMessage(status) {
    if (status === 401) return 'GitHub merge için güvenli Hafize oturumu gerekli.';
    if (status === 403) return 'Bu merge işlemi izin politikasına takıldı.';
    if (status === 409) return 'PR head değişti veya onay exact komutla eşleşmiyor. Güncel SHA ile yeniden hazırla.';
    if (status === 410) return 'GitHub merge onayının süresi doldu. Yeniden hazırla.';
    if (status === 422) return 'GitHub PR merge isteğini kabul etmedi. PR numarası ve exact head SHA bilgisini kontrol et.';
    if (status === 503) return 'GitHub yazma onay altyapısı şu anda kullanılamıyor.';
    if (status === 502) return 'GitHub merge işlemi güvenli yürütme sınırında başarısız oldu.';
    return 'GitHub merge işlemi tamamlanamadı.';
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
    if (typeof fetchImpl !== 'function') throw new Error('INVALID_GITHUB_PR_MERGE_FETCH');
    if (typeof AbortControllerImpl !== 'function') throw new Error('INVALID_GITHUB_PR_MERGE_ABORT_CONTROLLER');
    if (typeof setTimeoutImpl !== 'function' || typeof clearTimeoutImpl !== 'function') throw new Error('INVALID_GITHUB_PR_MERGE_TIMER');
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) throw new Error('INVALID_GITHUB_PR_MERGE_TIMEOUT');

    return Object.freeze({
      async post(path, body, { signal } = {}) {
        if (path !== PREPARE_PATH && path !== EXECUTE_PATH) throw new Error('INVALID_GITHUB_PR_MERGE_PATH');
        if (signal != null && (typeof signal !== 'object' || typeof signal.addEventListener !== 'function')) {
          throw new Error('INVALID_GITHUB_PR_MERGE_SIGNAL');
        }
        if (signal?.aborted) throw requestError('GITHUB_PR_MERGE_CANCELLED');

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
          if (timedOut) throw requestError('GITHUB_PR_MERGE_TIMEOUT');
          if (signal?.aborted) throw requestError('GITHUB_PR_MERGE_CANCELLED');
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
    if (!documentRef?.querySelector || !documentRef?.createElement) throw new Error('INVALID_GITHUB_PR_MERGE_DOCUMENT');
    if (typeof fetchImpl !== 'function' || typeof now !== 'function') throw new Error('INVALID_GITHUB_PR_MERGE_RUNTIME');

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
    let prInput = null;
    let shaInput = null;
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
    let cardBusyHad = false;
    let cardBusyValue = null;
    const listenerCleanup = [];

    function element(tag, className, text) {
      const node = documentRef.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    }

    function setStatus(text, state = 'idle') {
      if (destroyed || !status) return;
      status.textContent = text;
      status.dataset.state = state;
    }

    function clearPrepared({ announce = false } = {}) {
      prepared = null;
      if (approveButton) approveButton.hidden = true;
      if (summary) { summary.hidden = true; summary.textContent = ''; }
      if (announce) setStatus('PR bilgileri değişti; exact merge onayı yeniden hazırlanmalı.', 'idle');
    }

    function restoreCardBusy() {
      if (!card) return;
      if (cardBusyHad) card.setAttribute?.('aria-busy', cardBusyValue);
      else card.removeAttribute?.('aria-busy');
    }

    function setBusy(busy) {
      if (destroyed) return;
      if (busy) card?.setAttribute?.('aria-busy', 'true');
      else restoreCardBusy();
      for (const control of [prepareButton, approveButton, cancelButton, prInput, shaInput]) {
        if (control) control.disabled = Boolean(busy);
      }
    }

    function addListener(target, type, listener) {
      if (typeof target?.addEventListener !== 'function' || typeof target?.removeEventListener !== 'function') {
        throw new Error('INVALID_GITHUB_PR_MERGE_LISTENER_TARGET');
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

    function abortActive(reason = 'github-pr-merge-cancelled') {
      activeRequest?.controller?.abort?.(reason);
      activeRequest = null;
    }

    function beginRequest() {
      abortActive('github-pr-merge-superseded');
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
      if (!card || ACTIVE_CARDS.has(card) || card.querySelector?.('[data-github-pr-merge]')) return false;
      cardBusyHad = card.getAttribute?.('aria-busy') !== null;
      cardBusyValue = cardBusyHad ? card.getAttribute?.('aria-busy') : null;

      shell = element('div', 'github-pr-merge');
      shell.setAttribute('data-github-pr-merge', '1');
      toggle = element('button', 'mini-btn github-pr-merge-toggle', '⇄ PR birleştir');
      toggle.type = 'button';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-controls', 'githubPrMergeForm');

      form = element('form', 'github-pr-merge-form');
      form.id = 'githubPrMergeForm';
      form.hidden = true;
      form.noValidate = true;

      const warning = element('p', 'github-pr-merge-warning', 'Bu işlem geri alınamaz. Yalnız girdiğin exact PR head SHA hâlâ güncelse merge edilir.');
      const repo = element('p', 'github-pr-merge-repo', REPOSITORY);
      repo.setAttribute('aria-label', 'Hedef GitHub deposu');

      const prLabel = element('label', 'github-pr-merge-label');
      prLabel.append(element('span', '', 'Pull Request numarası'));
      prInput = element('input', 'github-pr-merge-input');
      prInput.type = 'text';
      prInput.inputMode = 'numeric';
      prInput.autocomplete = 'off';
      prInput.placeholder = '238';
      prInput.maxLength = 10;
      prInput.setAttribute('aria-label', 'Birleştirilecek Pull Request numarası');
      prLabel.append(prInput);

      const shaLabel = element('label', 'github-pr-merge-label');
      shaLabel.append(element('span', '', 'Beklenen head SHA'));
      shaInput = element('input', 'github-pr-merge-input github-pr-merge-sha');
      shaInput.type = 'text';
      shaInput.autocomplete = 'off';
      shaInput.spellcheck = false;
      shaInput.maxLength = 40;
      shaInput.placeholder = '40 karakterlik commit SHA';
      shaInput.setAttribute('aria-label', 'Pull Request exact head commit SHA');
      shaLabel.append(shaInput);

      summary = element('p', 'github-pr-merge-summary');
      summary.hidden = true;
      summary.setAttribute('role', 'status');
      status = element('p', 'github-pr-merge-status', 'Merge yalnız iki aşamalı açık onay ve exact head SHA ile çalışır.');
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      status.setAttribute('aria-atomic', 'true');

      const actions = element('div', 'github-pr-merge-actions');
      prepareButton = element('button', 'github-pr-merge-primary', 'Onayı hazırla');
      prepareButton.type = 'submit';
      approveButton = element('button', 'github-pr-merge-danger', 'Onayla ve PR’ı birleştir');
      approveButton.type = 'button';
      approveButton.hidden = true;
      cancelButton = element('button', 'mini-btn github-pr-merge-cancel', 'Kapat');
      cancelButton.type = 'button';
      actions.append(prepareButton, approveButton, cancelButton);

      form.append(warning, repo, prLabel, shaLabel, summary, status, actions);
      shell.append(toggle, form);
      card.append(shell);
      return true;
    }

    function currentCommand() {
      return destroyed ? null : buildCommand({ prNumber: prInput?.value, expectedHeadSha: shaInput?.value });
    }

    function openForm() {
      if (destroyed || !form) return false;
      form.hidden = false;
      toggle?.setAttribute?.('aria-expanded', 'true');
      prInput?.focus?.();
      return true;
    }

    function closeForm() {
      if (destroyed || !form) return false;
      abortActive('github-pr-merge-closed');
      setBusy(false);
      clearPrepared();
      form.hidden = true;
      toggle?.setAttribute?.('aria-expanded', 'false');
      setStatus('Merge yalnız iki aşamalı açık onay ve exact head SHA ile çalışır.', 'idle');
      toggle?.focus?.();
      return true;
    }

    async function prepare(event) {
      event?.preventDefault?.();
      if (destroyed || !mounted) return false;
      clearPrepared();
      const command = currentCommand();
      if (!command) {
        setStatus('Geçerli PR numarası ve 40 karakterlik exact head SHA gir.', 'error');
        prInput?.focus?.();
        return false;
      }
      let request;
      try { request = beginRequest(); }
      catch { setStatus('GitHub merge onay isteği başlatılamadı.', 'error'); return false; }
      setBusy(true);
      setStatus('Exact merge komutu güvenli onay sınırında hazırlanıyor…', 'loading');
      try {
        const { response, payload } = await client.post(PREPARE_PATH, { command }, { signal: request.controller.signal });
        if (!isCurrent(request)) return false;
        if (!response?.ok) { setStatus(errorMessage(response?.status), 'error'); return false; }
        const next = normalizePrepared(payload, command, now());
        if (!next) { setStatus('Sunucudan geçerli ve exact komutla eşleşen onay alınamadı.', 'error'); return false; }
        prepared = next;
        summary.textContent = `PR #${command.prNumber} · head ${command.expectedHeadSha.slice(0, 12)}…`;
        summary.hidden = false;
        approveButton.hidden = false;
        setStatus('Onay hazır. PR yalnız ikinci düğmeye basarsan ve head SHA değişmediyse birleştirilecek.', 'ready');
        approveButton.focus?.();
        return true;
      } catch (error) {
        if (!isCurrent(request)) return false;
        if (error?.code === 'GITHUB_PR_MERGE_TIMEOUT') setStatus('GitHub merge onayı zaman aşımına uğradı. Yeniden hazırlayabilirsin.', 'error');
        else if (error?.code !== 'GITHUB_PR_MERGE_CANCELLED') setStatus('GitHub merge onayı hazırlanırken bağlantı hatası oluştu.', 'error');
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
      if (!prepared) { setStatus('Önce bu exact PR merge komutu için onay hazırla.', 'error'); return false; }
      const live = currentCommand();
      if (!sameCommand(prepared.command, live)) {
        clearPrepared();
        setStatus('PR numarası veya head SHA değişti; eski onay kullanılmadı.', 'error');
        return false;
      }
      if (Date.parse(prepared.expiresAt) <= now()) {
        clearPrepared();
        setStatus('Merge onayının süresi doldu; yeniden hazırla.', 'error');
        return false;
      }
      const snapshot = prepared;
      let request;
      try { request = beginRequest(); }
      catch { setStatus('GitHub merge isteği başlatılamadı.', 'error'); return false; }
      setBusy(true);
      setStatus('Açık onayla exact-head PR merge işlemi yürütülüyor…', 'loading');
      try {
        const { response, payload } = await client.post(EXECUTE_PATH, { command: snapshot.command, approvalToken: snapshot.approvalToken }, { signal: request.controller.signal });
        if (!isCurrent(request)) return false;
        clearPrepared();
        if (!response?.ok) { setStatus(errorMessage(response?.status), 'error'); return false; }
        const receipt = normalizeReceipt(payload, snapshot.command);
        if (!receipt) {
          setStatus('GitHub merge sonucu doğrulanamadı. PR durumunu kontrol etmeden yeniden merge deneme.', 'error');
          return false;
        }
        setStatus(`PR #${receipt.prNumber} başarıyla birleştirildi.`, 'success');
        rootRef.dispatchEvent?.(new rootRef.CustomEvent('hafize:github-pr-merged', {
          detail: { operation: 'pr.merge', repository: REPOSITORY, prNumber: receipt.prNumber }
        }));
        return true;
      } catch (error) {
        if (!isCurrent(request)) return false;
        clearPrepared();
        if (error?.code === 'GITHUB_PR_MERGE_TIMEOUT') {
          setStatus('Merge isteği zaman aşımına uğradı; sonuç belirsiz olabilir. PR durumunu doğrulamadan yeniden merge deneme.', 'error');
        } else if (error?.code !== 'GITHUB_PR_MERGE_CANCELLED') {
          setStatus('Merge bağlantısı kesildi; sonuç belirsiz olabilir. PR durumunu doğrulamadan yeniden merge deneme.', 'error');
        }
        return false;
      } finally {
        if (activeRequest === request) {
          activeRequest = null;
          setBusy(false);
        }
      }
    }

    function onInput() {
      if (destroyed) return;
      if (prepared) clearPrepared({ announce: true });
    }

    function onToggle() {
      if (destroyed) return;
      if (form?.hidden) openForm(); else closeForm();
    }

    function onKeydown(event) {
      if (destroyed || event?.key !== 'Escape' || form?.hidden || card?.getAttribute?.('aria-busy') === 'true') return;
      event.preventDefault?.();
      closeForm();
    }

    function rollbackAttach() {
      while (listenerCleanup.length) {
        try { listenerCleanup.pop()?.(); } catch {}
      }
      shell?.remove?.();
      if (card) ACTIVE_CARDS.delete(card);
      restoreCardBusy();
      mounted = false;
      prepared = null;
      shell = null;
      toggle = null;
      form = null;
      prInput = null;
      shaInput = null;
      prepareButton = null;
      approveButton = null;
      cancelButton = null;
      status = null;
      summary = null;
    }

    function attach() {
      if (destroyed || mounted) return false;
      if (!build() || !toggle || !form) return false;
      ACTIVE_CARDS.add(card);
      try {
        addListener(toggle, 'click', onToggle);
        addListener(form, 'submit', prepare);
        addListener(approveButton, 'click', execute);
        addListener(cancelButton, 'click', closeForm);
        addListener(prInput, 'input', onInput);
        addListener(shaInput, 'input', onInput);
        addListener(documentRef, 'keydown', onKeydown);
        mounted = true;
        stopWaiting();
        return true;
      } catch {
        rollbackAttach();
        return false;
      }
    }

    function conflictingCardExists() {
      const target = documentRef.querySelector('#githubWriteReadinessCard');
      return Boolean(target && (ACTIVE_CARDS.has(target) || target.querySelector?.('[data-github-pr-merge]')));
    }

    function mount() {
      if (destroyed || mounted) return false;
      if (attach()) return true;
      if (conflictingCardExists()) return false;
      if (typeof rootRef.MutationObserver !== 'function' || !documentRef.body) return false;
      try {
        observer = new rootRef.MutationObserver(() => {
          if (destroyed || mounted) return;
          if (attach() || conflictingCardExists()) stopWaiting();
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
      abortActive('github-pr-merge-destroyed');
      stopWaiting();
      while (listenerCleanup.length) {
        try { listenerCleanup.pop()?.(); } catch {}
      }
      shell?.remove?.();
      restoreCardBusy();
      if (card) ACTIVE_CARDS.delete(card);
      mounted = false;
      prepared = null;
      shell = null;
      return true;
    }

    return Object.freeze({
      mount,
      destroy,
      prepare,
      execute,
      currentCommand,
      getPrepared: () => prepared,
      getState: () => Object.freeze({ mounted, destroyed, requestId: activeRequest?.id ?? null }),
      isMounted: () => mounted
    });
  }

  function mount() {
    if (!globalThis.document) return false;
    try { return createController().mount(); } catch { return false; }
  }

  return Object.freeze({
    REPOSITORY, PREPARE_PATH, EXECUTE_PATH, MAX_PR_NUMBER, MAX_APPROVAL_TOKEN_CHARS,
    MOUNT_TIMEOUT_MS, REQUEST_TIMEOUT_MS,
    normalizePrNumber, normalizeHeadSha, buildCommand, sameCommand, normalizePrepared, normalizeReceipt,
    errorMessage, createClient, createController, mount
  });
});
