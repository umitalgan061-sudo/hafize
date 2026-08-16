(function exposeHafizeTextFileImport(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeTextFileImport = api;
  api.mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeTextFileImport() {
  'use strict';

  const MAX_FILE_BYTES = 128 * 1024;
  const MAX_COMPOSER_CHARS = 12_000;
  const INPUT_ID = 'hafizeTextFileInput';
  const STATUS_ID = 'hafizeTextFileImportStatus';
  const ALLOWED_EXTENSIONS = Object.freeze(new Set([
    'txt', 'md', 'markdown', 'json', 'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx',
    'css', 'html', 'htm', 'xml', 'yaml', 'yml', 'toml', 'ini', 'csv', 'sql',
    'py', 'rb', 'php', 'java', 'kt', 'kts', 'go', 'rs', 'c', 'h', 'cpp', 'hpp',
    'cs', 'swift', 'sh', 'bash', 'zsh', 'fish', 'ps1', 'graphql', 'gql', 'env.example'
  ]));
  const MIME_ALLOWLIST = Object.freeze(new Set([
    'text/plain', 'text/markdown', 'text/csv', 'text/css', 'text/html', 'text/xml',
    'application/json', 'application/xml', 'application/graphql'
  ]));

  function safeFileName(value) {
    if (typeof value !== 'string') return 'metin-dosyasi.txt';
    const name = value
      .replace(/[\\/]/g, '-')
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);
    return name || 'metin-dosyasi.txt';
  }

  function fileExtension(name) {
    const safe = safeFileName(name).toLowerCase();
    if (safe.endsWith('.env.example')) return 'env.example';
    const dot = safe.lastIndexOf('.');
    return dot >= 0 && dot < safe.length - 1 ? safe.slice(dot + 1) : '';
  }

  function isAllowedFile(file) {
    if (!file || typeof file !== 'object') return false;
    const size = Number(file.size);
    if (!Number.isFinite(size) || size < 0 || size > MAX_FILE_BYTES) return false;
    const extension = fileExtension(file.name || '');
    const mime = typeof file.type === 'string' ? file.type.toLowerCase().trim() : '';
    return ALLOWED_EXTENSIONS.has(extension)
      || MIME_ALLOWLIST.has(mime)
      || (mime.startsWith('text/') && extension !== '');
  }

  function normalizeFileText(value) {
    if (typeof value !== 'string') return null;
    return value.replace(/\r\n?/g, '\n').replace(/\u0000/g, '');
  }

  function formatImport(name, text) {
    const normalized = normalizeFileText(text);
    if (normalized === null) return null;
    const label = safeFileName(name);
    return `--- Dosya: ${label} ---\n${normalized}\n--- Dosya sonu ---`;
  }

  function composeNextValue(current, imported) {
    if (typeof current !== 'string' || typeof imported !== 'string' || !imported) return null;
    const separator = current.length ? '\n\n' : '';
    const next = `${current}${separator}${imported}`;
    return next.length <= MAX_COMPOSER_CHARS ? next : null;
  }

  function installStatus(documentRef, button) {
    const existing = documentRef.querySelector?.(`#${STATUS_ID}`);
    if (existing) return existing;
    const status = documentRef.createElement('span');
    status.id = STATUS_ID;
    status.className = 'agent-hint';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.hidden = true;
    const parent = button?.parentNode;
    parent?.append?.(status);
    return status;
  }

  function installInput(documentRef) {
    const existing = documentRef.querySelector?.(`#${INPUT_ID}`);
    if (existing) return existing;
    const input = documentRef.createElement('input');
    input.id = INPUT_ID;
    input.type = 'file';
    input.accept = '.txt,.md,.markdown,.json,.js,.mjs,.cjs,.ts,.tsx,.jsx,.css,.html,.htm,.xml,.yaml,.yml,.toml,.ini,.csv,.sql,.py,.rb,.php,.java,.kt,.kts,.go,.rs,.c,.h,.cpp,.hpp,.cs,.swift,.sh,.bash,.zsh,.fish,.ps1,.graphql,.gql,.env.example,text/plain,text/markdown,text/csv,application/json';
    input.hidden = true;
    input.tabIndex = -1;
    input.setAttribute('aria-hidden', 'true');
    documentRef.body?.append?.(input);
    return input;
  }

  function createController({
    documentRef = globalThis.document,
    EventImpl = globalThis.Event,
    setTimeoutImpl = globalThis.setTimeout,
    clearTimeoutImpl = globalThis.clearTimeout
  } = {}) {
    if (!documentRef?.querySelector || !documentRef?.createElement) throw new Error('INVALID_TEXT_FILE_IMPORT_DOCUMENT');
    if (typeof setTimeoutImpl !== 'function' || typeof clearTimeoutImpl !== 'function') throw new Error('INVALID_TEXT_FILE_IMPORT_TIMER');

    let mounted = false;
    let input = null;
    let status = null;
    let hideTimer = null;

    function nodes() {
      return Object.freeze({
        button: documentRef.querySelector('#attachBtn'),
        composerInput: documentRef.querySelector('#messageInput')
      });
    }

    function showStatus(message, state = 'idle') {
      if (!status) return;
      if (hideTimer !== null) clearTimeoutImpl(hideTimer);
      hideTimer = null;
      status.textContent = message;
      status.dataset.state = state;
      status.hidden = !message;
      if (message) {
        hideTimer = setTimeoutImpl(() => {
          if (!status) return;
          status.hidden = true;
          status.textContent = '';
          hideTimer = null;
        }, 4200);
      }
    }

    function dispatchComposerInput(composerInput) {
      if (typeof EventImpl !== 'function' || typeof composerInput?.dispatchEvent !== 'function') return false;
      composerInput.dispatchEvent(new EventImpl('input', { bubbles: true }));
      return true;
    }

    async function importFile(file) {
      const { composerInput } = nodes();
      if (!composerInput || typeof composerInput.value !== 'string') {
        showStatus('Yazar kullanılamıyor.', 'error');
        return false;
      }
      if (!isAllowedFile(file)) {
        const size = Number(file?.size);
        showStatus(Number.isFinite(size) && size > MAX_FILE_BYTES
          ? 'Dosya 128 KiB sınırını aşıyor.'
          : 'Yalnız küçük metin/kod dosyaları eklenebilir.', 'error');
        return false;
      }
      if (typeof file.text !== 'function') {
        showStatus('Bu tarayıcı dosyayı okuyamıyor.', 'error');
        return false;
      }

      let text;
      try {
        text = await file.text();
      } catch {
        showStatus('Dosya okunamadı.', 'error');
        return false;
      }
      const imported = formatImport(file.name, text);
      const next = imported && composeNextValue(composerInput.value, imported);
      if (!next) {
        showStatus('Dosya yazarın 12.000 karakter sınırına sığmıyor.', 'error');
        return false;
      }

      composerInput.value = next;
      dispatchComposerInput(composerInput);
      composerInput.focus?.();
      if (typeof composerInput.setSelectionRange === 'function') {
        try { composerInput.setSelectionRange(next.length, next.length); } catch { /* unsupported */ }
      }
      showStatus(`${safeFileName(file.name)} yazara eklendi. Göndermek için sen onaylamalısın.`, 'success');
      return true;
    }

    function onAttachClick(event) {
      const { button } = nodes();
      if (!button || event?.currentTarget !== button) return false;
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
      if (!input || typeof input.click !== 'function') {
        showStatus('Dosya seçici kullanılamıyor.', 'error');
        return false;
      }
      input.click();
      return true;
    }

    function onInputChange() {
      const file = input?.files?.[0];
      if (input) input.value = '';
      if (!file) return;
      void importFile(file);
    }

    function mount() {
      if (mounted) return true;
      const { button } = nodes();
      if (!button || !documentRef.body) return false;
      input = installInput(documentRef);
      status = installStatus(documentRef, button);
      if (!input || !status) return false;
      button.setAttribute?.('title', 'Küçük bir metin veya kod dosyasını yazara ekle');
      button.setAttribute?.('aria-describedby', STATUS_ID);
      button.addEventListener?.('click', onAttachClick, true);
      input.addEventListener?.('change', onInputChange);
      mounted = true;
      return true;
    }

    function destroy() {
      if (!mounted) return;
      const { button } = nodes();
      button?.removeEventListener?.('click', onAttachClick, true);
      input?.removeEventListener?.('change', onInputChange);
      input?.remove?.();
      status?.remove?.();
      if (hideTimer !== null) clearTimeoutImpl(hideTimer);
      hideTimer = null;
      input = null;
      status = null;
      mounted = false;
    }

    return Object.freeze({ mount, destroy, importFile, onAttachClick, snapshot: () => Object.freeze({ mounted }) });
  }

  function mount(options) {
    try {
      const controller = createController(options);
      return controller.mount() ? controller : null;
    } catch {
      return null;
    }
  }

  return Object.freeze({
    MAX_FILE_BYTES,
    MAX_COMPOSER_CHARS,
    INPUT_ID,
    STATUS_ID,
    ALLOWED_EXTENSIONS,
    MIME_ALLOWLIST,
    safeFileName,
    fileExtension,
    isAllowedFile,
    normalizeFileText,
    formatImport,
    composeNextValue,
    createController,
    mount
  });
});
