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
  const SHA_PATTERN = /^[a-f0-9]{40}$/;
  const APPROVAL_TOKEN_PATTERN = /^gw1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/;

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

  function createController({
    documentRef = globalThis.document,
    rootRef = globalThis,
    fetchImpl = globalThis.fetch,
    now = () => Date.now()
  } = {}) {
    if (!documentRef?.querySelector || !documentRef?.createElement) throw new Error('INVALID_GITHUB_PR_MERGE_DOCUMENT');
    if (typeof fetchImpl !== 'function' || typeof now !== 'function') throw new Error('INVALID_GITHUB_PR_MERGE_RUNTIME');

    let mounted = false;
    let card = null;
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
      if (announce) setStatus('PR bilgileri değişti; exact merge onayı yeniden hazırlanmalı.', 'idle');
    }

    function setBusy(busy) {
      card?.setAttribute?.('aria-busy', String(Boolean(busy)));
      for (const control of [prepareButton, approveButton, cancelButton, prInput, shaInput]) {
        if (control) control.disabled = Boolean(busy);
      }
    }

    function build() {
      card = documentRef.querySelector('#githubWriteReadinessCard');
      if (!card || card.querySelector?.('[data-github-pr-merge]')) return Boolean(card);

      const shell = element('div', 'github-pr-merge');
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

    function openForm() {
      if (!form) return;
      form.hidden = false;
      toggle?.setAttribute?.('aria-expanded', 'true');
      prInput?.focus?.();
    }

    function closeForm() {
      if (!form) return;
      requestController?.abort?.();
      setBusy(false);
      clearPrepared();
      form.hidden = true;
      toggle?.setAttribute?.('aria-expanded', 'false');
      setStatus('Merge yalnız iki aşamalı açık onay ve exact head SHA ile çalışır.', 'idle');
      toggle?.focus?.();
    }

    function currentCommand() {
      return buildCommand({ prNumber: prInput?.value, expectedHeadSha: shaInput?.value });
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
        setStatus('Geçerli PR numarası ve 40 karakterlik exact head SHA gir.', 'error');
        prInput?.focus?.();
        return false;
      }
      setBusy(true);
      setStatus('Exact merge komutu güvenli onay sınırında hazırlanıyor…', 'loading');
      try {
        const { response, payload } = await postJson(PREPARE_PATH, { command });
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
        if (error?.name !== 'AbortError') setStatus('GitHub merge onayı hazırlanırken bağlantı hatası oluştu.', 'error');
        return false;
      } finally {
        setBusy(false);
      }
    }

    async function execute() {
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
      setBusy(true);
      setStatus('Açık onayla exact-head PR merge işlemi yürütülüyor…', 'loading');
      try {
        const { response, payload } = await postJson(EXECUTE_PATH, { command: snapshot.command, approvalToken: snapshot.approvalToken });
        clearPrepared();
        if (!response?.ok) { setStatus(errorMessage(response?.status), 'error'); return false; }
        const receipt = normalizeReceipt(payload, snapshot.command);
        if (!receipt) { setStatus('GitHub merge sonucu doğrulanamadı.', 'error'); return false; }
        setStatus(`PR #${receipt.prNumber} başarıyla birleştirildi.`, 'success');
        rootRef.dispatchEvent?.(new rootRef.CustomEvent('hafize:github-pr-merged', {
          detail: { operation: 'pr.merge', repository: REPOSITORY, prNumber: receipt.prNumber }
        }));
        return true;
      } catch (error) {
        if (error?.name !== 'AbortError') setStatus('GitHub merge sırasında bağlantı hatası oluştu.', 'error');
        return false;
      } finally {
        setBusy(false);
      }
    }

    function onInput() { if (prepared) clearPrepared({ announce: true }); }
    function onToggle() { if (form?.hidden) openForm(); else closeForm(); }
    function onKeydown(event) { if (event?.key === 'Escape' && form && !form.hidden) { event.preventDefault?.(); closeForm(); } }

    function attach() {
      if (mounted || !build()) return false;
      mounted = true;
      observer?.disconnect?.(); observer = null;
      if (mountTimer !== null) rootRef.clearTimeout?.(mountTimer);
      mountTimer = null;
      toggle.addEventListener('click', onToggle);
      form.addEventListener('submit', prepare);
      approveButton.addEventListener('click', execute);
      cancelButton.addEventListener('click', closeForm);
      prInput.addEventListener('input', onInput);
      shaInput.addEventListener('input', onInput);
      documentRef.addEventListener?.('keydown', onKeydown);
      return true;
    }

    function mount() {
      if (attach()) return true;
      if (typeof rootRef.MutationObserver !== 'function') return false;
      observer = new rootRef.MutationObserver(() => attach());
      observer.observe(documentRef.body || documentRef.documentElement, { childList: true, subtree: true });
      mountTimer = rootRef.setTimeout?.(() => { observer?.disconnect?.(); observer = null; mountTimer = null; }, MOUNT_TIMEOUT_MS) ?? null;
      return false;
    }

    function destroy() {
      requestController?.abort?.();
      observer?.disconnect?.(); observer = null;
      if (mountTimer !== null) rootRef.clearTimeout?.(mountTimer);
      mountTimer = null;
      documentRef.removeEventListener?.('keydown', onKeydown);
      toggle?.removeEventListener?.('click', onToggle);
      form?.removeEventListener?.('submit', prepare);
      approveButton?.removeEventListener?.('click', execute);
      cancelButton?.removeEventListener?.('click', closeForm);
      prInput?.removeEventListener?.('input', onInput);
      shaInput?.removeEventListener?.('input', onInput);
      card?.querySelector?.('[data-github-pr-merge]')?.remove?.();
      mounted = false;
      prepared = null;
    }

    return Object.freeze({ mount, destroy, prepare, execute, currentCommand, isMounted: () => mounted });
  }

  function mount() {
    if (!globalThis.document) return null;
    try { return createController().mount(); } catch { return null; }
  }

  return Object.freeze({
    REPOSITORY, PREPARE_PATH, EXECUTE_PATH, MAX_PR_NUMBER, MAX_APPROVAL_TOKEN_CHARS, MOUNT_TIMEOUT_MS,
    normalizePrNumber, normalizeHeadSha, buildCommand, sameCommand, normalizePrepared, normalizeReceipt, errorMessage,
    createController, mount
  });
});
