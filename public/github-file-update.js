(function exposeHafizeGitHubFileUpdate(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) { module.exports = api; return; }
  root.HafizeGitHubFileUpdate = api;
  api.mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeGitHubFileUpdate() {
  'use strict';

  const REPOSITORY = 'umitalgan061-sudo/hafize';
  const PREPARE_PATH = '/api/github/write/prepare';
  const EXECUTE_PATH = '/api/github/write/execute';
  const BRANCH_PREFIX = 'hafize/';
  const MAX_BRANCH_CHARS = 120;
  const MAX_PATH_CHARS = 400;
  const MAX_COMMIT_CHARS = 200;
  const MAX_CONTENT_BYTES = 64 * 1024;
  const MAX_APPROVAL_TOKEN_CHARS = 2048;
  const MOUNT_TIMEOUT_MS = 10_000;
  const REQUEST_TIMEOUT_MS = 30_000;
  const REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
  const SHA_PATTERN = /^[a-f0-9]{40}$/;
  const APPROVAL_TOKEN_PATTERN = /^gw1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/;
  const ACTIVE_CARDS = new WeakSet();
  const SENSITIVE_SEGMENT_PATTERNS = [
    /^\.env(?:\.|$)/i,
    /(?:^|[._-])(?:credential|secret|token)s?(?:[._-]|$)/i,
    /(?:^|[._-])private[._-]?key(?:[._-]|$)/i,
    /^id_(?:rsa|ed25519|ecdsa)(?:\.|$)/i,
    /\.(?:pem|key|p12|pfx)$/i
  ];

  function normalizeBranch(value) {
    const branch = typeof value === 'string' ? value.trim() : '';
    if (!branch || branch.length > MAX_BRANCH_CHARS || !REF_PATTERN.test(branch)) return null;
    if (!branch.startsWith(BRANCH_PREFIX) || branch.length <= BRANCH_PREFIX.length) return null;
    if (branch.includes('..') || branch.includes('//') || branch.endsWith('/')) return null;
    return branch;
  }

  function normalizePath(value) {
    const path = typeof value === 'string' ? value.trim() : '';
    if (!path || path.length > MAX_PATH_CHARS || path.startsWith('/') || path.includes('\\') || path.includes('\0')) return null;
    const segments = path.split('/');
    if (segments.some((segment) => !segment || segment === '.' || segment === '..')) return null;
    if (segments.some((segment) => SENSITIVE_SEGMENT_PATTERNS.some((pattern) => pattern.test(segment)))) return null;
    if (path.toLowerCase().startsWith('.github/workflows/')) return null;
    return path;
  }

  function normalizeBlobSha(value) {
    const sha = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return SHA_PATTERN.test(sha) ? sha : null;
  }

  function normalizeCommitMessage(value) {
    const message = typeof value === 'string' ? value.trim() : '';
    if (!message || message.length > MAX_COMMIT_CHARS) return null;
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(message)) return null;
    return message;
  }

  function utf8Bytes(value) {
    if (typeof value !== 'string') return Infinity;
    if (typeof TextEncoder === 'function') return new TextEncoder().encode(value).byteLength;
    return unescape(encodeURIComponent(value)).length;
  }

  function normalizeContent(value) {
    if (typeof value !== 'string' || !value.length || value.includes('\0')) return null;
    return utf8Bytes(value) <= MAX_CONTENT_BYTES ? value : null;
  }

  function buildCommand({ branch, path, expectedBlobSha, commitMessage, content } = {}) {
    const cleanBranch = normalizeBranch(branch);
    const cleanPath = normalizePath(path);
    const cleanSha = normalizeBlobSha(expectedBlobSha);
    const cleanMessage = normalizeCommitMessage(commitMessage);
    const cleanContent = normalizeContent(content);
    if (!cleanBranch || !cleanPath || !cleanSha || !cleanMessage || cleanContent === null) return null;
    return Object.freeze({
      operation: 'file.update', repository: REPOSITORY, branch: cleanBranch, path: cleanPath,
      expectedBlobSha: cleanSha, commitMessage: cleanMessage, content: cleanContent
    });
  }

  function sameCommand(left, right) {
    return Boolean(left && right
      && left.operation === 'file.update' && right.operation === 'file.update'
      && left.repository === REPOSITORY && right.repository === REPOSITORY
      && left.branch === right.branch && left.path === right.path
      && left.expectedBlobSha === right.expectedBlobSha
      && left.commitMessage === right.commitMessage && left.content === right.content
      && Object.keys(right).length === 7);
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

  function normalizeReceipt(value, command) {
    const receipt = value?.receipt;
    if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) return null;
    if (receipt.operation !== 'file.update' || receipt.repository !== REPOSITORY) return null;
    if (receipt.branch !== command.branch || receipt.path !== command.path) return null;
    const commitSha = normalizeBlobSha(receipt.commitSha);
    const blobSha = normalizeBlobSha(receipt.blobSha);
    if (!commitSha || !blobSha) return null;
    return Object.freeze({ commitSha, blobSha });
  }

  function errorMessage(status) {
    if (status === 401) return 'GitHub yazma için güvenli Hafize oturumu gerekli.';
    if (status === 403) return 'Bu dosya veya branch GitHub yazma politikasına takıldı.';
    if (status === 409) return 'Dosya değişmiş olabilir veya onay exact komutla eşleşmiyor.';
    if (status === 410) return 'GitHub yazma onayının süresi doldu. Yeniden hazırla.';
    if (status === 413) return 'Dosya içeriği izin verilen boyutu aşıyor.';
    if (status === 503) return 'GitHub yazma altyapısı şu anda kullanılamıyor.';
    if (status === 502) return 'GitHub dosya güncellemesi güvenli yürütme sınırında başarısız oldu.';
    return 'GitHub dosya güncellemesi tamamlanamadı.';
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
    if (typeof fetchImpl !== 'function') throw new Error('INVALID_GITHUB_FILE_UPDATE_FETCH');
    if (typeof AbortControllerImpl !== 'function') throw new Error('INVALID_GITHUB_FILE_UPDATE_ABORT_CONTROLLER');
    if (typeof setTimeoutImpl !== 'function' || typeof clearTimeoutImpl !== 'function') throw new Error('INVALID_GITHUB_FILE_UPDATE_TIMER');
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) throw new Error('INVALID_GITHUB_FILE_UPDATE_TIMEOUT');

    return Object.freeze({
      async post(path, body, { signal } = {}) {
        if (path !== PREPARE_PATH && path !== EXECUTE_PATH) throw new Error('INVALID_GITHUB_FILE_UPDATE_PATH');
        if (signal != null && (typeof signal !== 'object' || typeof signal.addEventListener !== 'function')) {
          throw new Error('INVALID_GITHUB_FILE_UPDATE_SIGNAL');
        }
        if (signal?.aborted) throw requestError('GITHUB_FILE_UPDATE_CANCELLED');

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
          if (timedOut) throw requestError('GITHUB_FILE_UPDATE_TIMEOUT');
          if (signal?.aborted) throw requestError('GITHUB_FILE_UPDATE_CANCELLED');
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
    if (!documentRef?.querySelector || !documentRef?.createElement) throw new Error('INVALID_GITHUB_FILE_UPDATE_DOCUMENT');
    if (typeof fetchImpl !== 'function' || typeof now !== 'function') throw new Error('INVALID_GITHUB_FILE_UPDATE_RUNTIME');

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
    let branchInput = null;
    let pathInput = null;
    let shaInput = null;
    let messageInput = null;
    let contentInput = null;
    let prepareButton = null;
    let approveButton = null;
    let closeButton = null;
    let status = null;
    let summary = null;
    let bytesLabel = null;
    let prepared = null;
    let activeRequest = null;
    let requestGeneration = 0;
    let observer = null;
    let mountTimer = null;
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
      if (announce) setStatus('Dosya bilgileri değişti; önce yeni onay hazırlanmalı.', 'idle');
    }

    function updateBytes() {
      if (destroyed) return;
      const bytes = utf8Bytes(contentInput?.value || '');
      if (bytesLabel) bytesLabel.textContent = `${Number.isFinite(bytes) ? bytes : 0} / ${MAX_CONTENT_BYTES} bayt`;
      contentInput?.setAttribute?.('aria-invalid', String(bytes > MAX_CONTENT_BYTES));
    }

    function setBusy(busy) {
      if (destroyed) return;
      card?.setAttribute?.('aria-busy', String(Boolean(busy)));
      for (const node of [branchInput, pathInput, shaInput, messageInput, contentInput, prepareButton, approveButton, closeButton]) {
        if (node) node.disabled = Boolean(busy);
      }
    }

    function addListener(target, type, listener) {
      if (typeof target?.addEventListener !== 'function' || typeof target?.removeEventListener !== 'function') {
        throw new Error('INVALID_GITHUB_FILE_UPDATE_LISTENER_TARGET');
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

    function abortActive(reason = 'github-file-update-cancelled') {
      activeRequest?.controller?.abort?.(reason);
      activeRequest = null;
    }

    function beginRequest() {
      abortActive('github-file-update-superseded');
      const controller = new rootRef.AbortController();
      const request = Object.freeze({ id: ++requestGeneration, controller });
      activeRequest = request;
      return request;
    }

    function isCurrent(request) {
      return !destroyed && mounted && activeRequest === request;
    }

    function field(labelText, input) {
      const label = element('label', 'github-file-update-label');
      label.append(element('span', '', labelText), input);
      return label;
    }

    function build() {
      card = documentRef.querySelector('#githubWriteReadinessCard');
      if (!card || ACTIVE_CARDS.has(card) || card.querySelector?.('[data-github-file-update]')) return false;
      shell = element('div', 'github-file-update');
      shell.setAttribute('data-github-file-update', '1');
      toggle = element('button', 'mini-btn github-file-update-toggle', '✎ Dosya');
      toggle.type = 'button';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-controls', 'githubFileUpdateForm');
      form = element('form', 'github-file-update-form');
      form.id = 'githubFileUpdateForm';
      form.hidden = true;
      form.noValidate = true;
      const repo = element('p', 'github-file-update-repo', REPOSITORY);
      repo.setAttribute('aria-label', 'Hedef GitHub deposu');

      branchInput = element('input', 'github-file-update-input');
      branchInput.maxLength = MAX_BRANCH_CHARS;
      branchInput.autocomplete = 'off';
      branchInput.spellcheck = false;
      branchInput.placeholder = 'hafize/ozellik-adi';
      pathInput = element('input', 'github-file-update-input');
      pathInput.maxLength = MAX_PATH_CHARS;
      pathInput.autocomplete = 'off';
      pathInput.spellcheck = false;
      pathInput.placeholder = 'public/ornek.js';
      shaInput = element('input', 'github-file-update-input github-file-update-sha');
      shaInput.maxLength = 40;
      shaInput.autocomplete = 'off';
      shaInput.spellcheck = false;
      shaInput.placeholder = '40 karakter blob SHA';
      messageInput = element('input', 'github-file-update-input');
      messageInput.maxLength = MAX_COMMIT_CHARS;
      messageInput.autocomplete = 'off';
      messageInput.placeholder = 'Kısa commit mesajı';
      contentInput = element('textarea', 'github-file-update-content');
      contentInput.rows = 10;
      contentInput.spellcheck = false;
      contentInput.placeholder = 'Dosyanın yeni tam içeriği';
      bytesLabel = element('small', 'github-file-update-bytes', `0 / ${MAX_CONTENT_BYTES} bayt`);

      summary = element('p', 'github-file-update-summary');
      summary.hidden = true;
      summary.setAttribute('role', 'status');
      status = element('p', 'github-file-update-status', 'Dosya güncellemesi yalnız existing blob SHA + iki aşamalı açık onayla çalışır.');
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      status.setAttribute('aria-atomic', 'true');
      const actions = element('div', 'github-file-update-actions');
      prepareButton = element('button', 'github-file-update-primary', 'Onayı hazırla');
      prepareButton.type = 'submit';
      approveButton = element('button', 'github-file-update-primary github-file-update-approve', 'Onayla ve dosyayı güncelle');
      approveButton.type = 'button';
      approveButton.hidden = true;
      closeButton = element('button', 'mini-btn github-file-update-close', 'Kapat');
      closeButton.type = 'button';
      actions.append(prepareButton, approveButton, closeButton);
      form.append(repo, field('Hedef branch', branchInput), field('Dosya yolu', pathInput), field('Mevcut blob SHA', shaInput), field('Commit mesajı', messageInput), field('Yeni tam içerik', contentInput), bytesLabel, summary, status, actions);
      shell.append(toggle, form);
      card.append(shell);
      return true;
    }

    function currentCommand() {
      return destroyed ? null : buildCommand({
        branch: branchInput?.value,
        path: pathInput?.value,
        expectedBlobSha: shaInput?.value,
        commitMessage: messageInput?.value,
        content: contentInput?.value
      });
    }

    function openForm() {
      if (destroyed || !form) return false;
      form.hidden = false;
      toggle?.setAttribute?.('aria-expanded', 'true');
      branchInput?.focus?.();
      return true;
    }

    function closeForm() {
      if (destroyed || !form) return false;
      abortActive('github-file-update-closed');
      setBusy(false);
      clearPrepared();
      form.hidden = true;
      toggle?.setAttribute?.('aria-expanded', 'false');
      setStatus('Dosya güncellemesi yalnız existing blob SHA + iki aşamalı açık onayla çalışır.', 'idle');
      toggle?.focus?.();
      return true;
    }

    async function prepare(event) {
      event?.preventDefault?.();
      if (destroyed || !mounted) return false;
      clearPrepared();
      const command = currentCommand();
      if (!command) {
        setStatus('Branch, güvenli dosya yolu, mevcut blob SHA, commit mesajı ve bounded içerik gerekli.', 'error');
        return false;
      }
      let request;
      try { request = beginRequest(); }
      catch { setStatus('GitHub onay isteği başlatılamadı.', 'error'); return false; }
      setBusy(true);
      setStatus('Exact dosya güncelleme komutu onay için hazırlanıyor…', 'loading');
      try {
        const { response, payload } = await client.post(PREPARE_PATH, { command }, { signal: request.controller.signal });
        if (!isCurrent(request)) return false;
        if (!response?.ok) { setStatus(errorMessage(response?.status), 'error'); return false; }
        const next = normalizePrepared(payload, command, now());
        if (!next) { setStatus('Sunucudan exact komutla eşleşen geçerli onay alınamadı.', 'error'); return false; }
        prepared = next;
        summary.textContent = `${command.branch}:${command.path} · ${utf8Bytes(command.content)} bayt`;
        summary.hidden = false;
        approveButton.hidden = false;
        setStatus('Onay hazır. Dosya ancak ikinci düğmeye basarsan güncellenecek.', 'ready');
        approveButton.focus?.();
        return true;
      } catch (error) {
        if (!isCurrent(request)) return false;
        if (error?.code === 'GITHUB_FILE_UPDATE_TIMEOUT') setStatus('GitHub onay isteği zaman aşımına uğradı. Tekrar deneyebilirsin.', 'error');
        else if (error?.code !== 'GITHUB_FILE_UPDATE_CANCELLED') setStatus('GitHub onayı hazırlanırken bağlantı hatası oluştu.', 'error');
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
      if (!prepared) { setStatus('Önce exact dosya güncellemesi için onay hazırla.', 'error'); return false; }
      const live = currentCommand();
      if (!sameCommand(prepared.command, live)) {
        clearPrepared();
        setStatus('Dosya bilgileri değişti; eski onay kullanılmadı.', 'error');
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
      catch { setStatus('GitHub dosya güncelleme isteği başlatılamadı.', 'error'); return false; }
      setBusy(true);
      setStatus('Açık onayla GitHub dosyası güncelleniyor…', 'loading');
      try {
        const { response, payload } = await client.post(EXECUTE_PATH, { command: snapshot.command, approvalToken: snapshot.approvalToken }, { signal: request.controller.signal });
        if (!isCurrent(request)) return false;
        clearPrepared();
        if (!response?.ok) { setStatus(errorMessage(response?.status), 'error'); return false; }
        const receipt = normalizeReceipt(payload, snapshot.command);
        if (!receipt) { setStatus('GitHub dosya güncelleme sonucu doğrulanamadı.', 'error'); return false; }
        shaInput.value = receipt.blobSha;
        setStatus(`Dosya güncellendi. Yeni blob: ${receipt.blobSha.slice(0, 12)}…`, 'success');
        rootRef.dispatchEvent?.(new rootRef.CustomEvent('hafize:github-file-updated', { detail: { path: snapshot.command.path, branch: snapshot.command.branch } }));
        return true;
      } catch (error) {
        if (!isCurrent(request)) return false;
        clearPrepared();
        if (error?.code === 'GITHUB_FILE_UPDATE_TIMEOUT') setStatus('GitHub dosya güncelleme isteği zaman aşımına uğradı. Yeniden onay hazırlayıp deneyebilirsin.', 'error');
        else if (error?.code !== 'GITHUB_FILE_UPDATE_CANCELLED') setStatus('GitHub dosyası güncellenirken bağlantı hatası oluştu.', 'error');
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
      updateBytes();
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

    function attach() {
      if (destroyed || mounted) return false;
      if (!build() || !toggle || !form) return false;
      ACTIVE_CARDS.add(card);
      try {
        addListener(toggle, 'click', onToggle);
        addListener(form, 'submit', prepare);
        addListener(approveButton, 'click', execute);
        addListener(closeButton, 'click', closeForm);
        for (const input of [branchInput, pathInput, shaInput, messageInput, contentInput]) addListener(input, 'input', onInput);
        addListener(documentRef, 'keydown', onKeydown);
        updateBytes();
        mounted = true;
        return true;
      } catch {
        while (listenerCleanup.length) {
          try { listenerCleanup.pop()?.(); } catch {}
        }
        shell?.remove?.();
        ACTIVE_CARDS.delete(card);
        card = null;
        shell = null;
        toggle = null;
        form = null;
        return false;
      }
    }

    function mount() {
      if (destroyed || mounted) return false;
      if (attach()) return true;
      if (typeof rootRef.MutationObserver !== 'function' || !documentRef.body) return false;
      try {
        observer = new rootRef.MutationObserver(() => {
          if (destroyed || mounted) return;
          if (attach()) stopWaiting();
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
      abortActive('github-file-update-destroyed');
      stopWaiting();
      while (listenerCleanup.length) {
        try { listenerCleanup.pop()?.(); } catch {}
      }
      shell?.remove?.();
      if (card) {
        card.removeAttribute?.('aria-busy');
        ACTIVE_CARDS.delete(card);
      }
      mounted = false;
      prepared = null;
      shell = null;
      return true;
    }

    return Object.freeze({
      mount,
      destroy,
      getPrepared: () => prepared,
      getState: () => Object.freeze({ mounted, destroyed, requestId: activeRequest?.id ?? null }),
      buildCommand: currentCommand
    });
  }

  function mount() { try { return createController().mount(); } catch { return false; } }
  return Object.freeze({
    REPOSITORY, PREPARE_PATH, EXECUTE_PATH, BRANCH_PREFIX, MAX_BRANCH_CHARS, MAX_PATH_CHARS,
    MAX_COMMIT_CHARS, MAX_CONTENT_BYTES, MOUNT_TIMEOUT_MS, REQUEST_TIMEOUT_MS,
    normalizeBranch, normalizePath, normalizeBlobSha, normalizeCommitMessage, normalizeContent,
    utf8Bytes, buildCommand, sameCommand, normalizePrepared, normalizeReceipt, createClient, createController, mount
  });
});
