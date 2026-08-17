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
  const MAX_FILES = 4;
  const MAX_COMPOSER_CHARS = 12_000;
  const MAX_PREVIEW_CHARS = 180;
  const INPUT_ID = 'hafizeTextFileInput';
  const STATUS_ID = 'hafizeTextFileImportStatus';
  const REVIEW_ID = 'hafizeTextFileImportReview';
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
    return `--- Dosya: ${safeFileName(name)} ---\n${normalized}\n--- Dosya sonu ---`;
  }

  function composeNextValue(current, imports) {
    if (typeof current !== 'string' || !Array.isArray(imports) || !imports.length) return null;
    if (imports.some((value) => typeof value !== 'string' || !value)) return null;
    const addition = imports.join('\n\n');
    const next = `${current}${current.length ? '\n\n' : ''}${addition}`;
    return next.length <= MAX_COMPOSER_CHARS ? next : null;
  }

  function previewText(value) {
    const normalized = normalizeFileText(value);
    if (normalized === null) return '';
    const compact = normalized.replace(/\s+/g, ' ').trim();
    if (compact.length <= MAX_PREVIEW_CHARS) return compact;
    return `${compact.slice(0, MAX_PREVIEW_CHARS - 1)}…`;
  }

  function normalizeSelection(files) {
    const source = Array.from(files || []).slice(0, MAX_FILES);
    return Object.freeze(source.map((file, index) => Object.freeze({ file, index })));
  }

  function installStatus(documentRef, button) {
    const existing = documentRef.querySelector?.(`#${STATUS_ID}`);
    if (existing) return existing;
    const status = documentRef.createElement('span');
    status.id = STATUS_ID;
    status.className = 'text-file-import-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.hidden = true;
    button?.parentNode?.append?.(status);
    return status;
  }

  function installInput(documentRef) {
    const existing = documentRef.querySelector?.(`#${INPUT_ID}`);
    if (existing) return existing;
    const input = documentRef.createElement('input');
    input.id = INPUT_ID;
    input.type = 'file';
    input.multiple = true;
    input.accept = '.txt,.md,.markdown,.json,.js,.mjs,.cjs,.ts,.tsx,.jsx,.css,.html,.htm,.xml,.yaml,.yml,.toml,.ini,.csv,.sql,.py,.rb,.php,.java,.kt,.kts,.go,.rs,.c,.h,.cpp,.hpp,.cs,.swift,.sh,.bash,.zsh,.fish,.ps1,.graphql,.gql,.env.example,text/plain,text/markdown,text/csv,application/json';
    input.hidden = true;
    input.tabIndex = -1;
    input.setAttribute('aria-hidden', 'true');
    documentRef.body?.append?.(input);
    return input;
  }

  function installReview(documentRef, composer) {
    const existing = documentRef.querySelector?.(`#${REVIEW_ID}`);
    if (existing) return existing;
    const review = documentRef.createElement('section');
    review.id = REVIEW_ID;
    review.className = 'text-file-import-review';
    review.hidden = true;
    review.setAttribute('aria-label', 'Dosya ekleme incelemesi');
    review.innerHTML = [
      '<div class="text-file-import-review-head">',
      '<strong>Dosyaları yazara eklemeden önce kontrol et</strong>',
      '<button type="button" class="text-file-import-close" aria-label="Dosya incelemesini kapat">×</button>',
      '</div>',
      '<p class="text-file-import-summary" role="status" aria-live="polite"></p>',
      '<div class="text-file-import-items"></div>',
      '<div class="text-file-import-actions">',
      '<button type="button" class="text-file-import-cancel">Vazgeç</button>',
      '<button type="button" class="text-file-import-confirm">Yazara ekle</button>',
      '</div>'
    ].join('');
    composer?.append?.(review);
    return review;
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
    let review = null;
    let staged = [];
    let hideTimer = null;
    let generation = 0;

    function nodes() {
      return Object.freeze({
        button: documentRef.querySelector('#attachBtn'),
        composer: documentRef.querySelector('#composer'),
        composerInput: documentRef.querySelector('#messageInput'),
        sendButton: documentRef.querySelector('#sendBtn')
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

    function isStreaming() {
      return nodes().sendButton?.classList?.contains?.('streaming') === true;
    }

    function clearStaged({ focusButton = false } = {}) {
      generation += 1;
      staged = [];
      if (review) {
        review.hidden = true;
        review.querySelector?.('.text-file-import-items')?.replaceChildren?.();
        const summary = review.querySelector?.('.text-file-import-summary');
        if (summary) summary.textContent = '';
      }
      if (focusButton) nodes().button?.focus?.();
    }

    function renderReview() {
      if (!review) return;
      const items = review.querySelector('.text-file-import-items');
      const summary = review.querySelector('.text-file-import-summary');
      const confirm = review.querySelector('.text-file-import-confirm');
      if (!items || !summary || !confirm) return;
      items.replaceChildren();

      staged.forEach((entry, index) => {
        const row = documentRef.createElement('article');
        row.className = 'text-file-import-item';
        const copy = documentRef.createElement('div');
        copy.className = 'text-file-import-copy';
        const name = documentRef.createElement('strong');
        name.textContent = entry.name;
        const meta = documentRef.createElement('span');
        meta.textContent = `${entry.size.toLocaleString('tr-TR')} bayt · ${entry.text.length.toLocaleString('tr-TR')} karakter`;
        const preview = documentRef.createElement('p');
        preview.textContent = previewText(entry.text) || 'Boş metin dosyası';
        const remove = documentRef.createElement('button');
        remove.type = 'button';
        remove.className = 'text-file-import-remove';
        remove.textContent = 'Kaldır';
        remove.setAttribute('aria-label', `${entry.name} dosyasını listeden kaldır`);
        remove.addEventListener('click', () => {
          staged = staged.filter((_, stagedIndex) => stagedIndex !== index);
          if (!staged.length) clearStaged({ focusButton: true });
          else renderReview();
        });
        copy.append(name, meta, preview);
        row.append(copy, remove);
        items.append(row);
      });

      summary.textContent = staged.length
        ? `${staged.length} dosya yalnız bu sayfada geçici olarak hazır. Yazara henüz eklenmedi.`
        : '';
      confirm.disabled = staged.length === 0 || isStreaming();
      review.hidden = staged.length === 0;
    }

    async function stageFiles(files) {
      if (isStreaming()) {
        showStatus('Yanıt sürerken dosya hazırlanamaz.', 'error');
        return false;
      }
      const selection = normalizeSelection(files);
      if (!selection.length) return false;
      if (Array.from(files || []).length > MAX_FILES) {
        showStatus(`Tek seferde en fazla ${MAX_FILES} dosya seçilebilir.`, 'error');
        return false;
      }
      const currentGeneration = ++generation;
      const next = [];
      for (const { file } of selection) {
        if (!isAllowedFile(file)) {
          showStatus(Number(file?.size) > MAX_FILE_BYTES
            ? `${safeFileName(file?.name)} 128 KiB sınırını aşıyor.`
            : `${safeFileName(file?.name)} desteklenen bir metin/kod dosyası değil.`, 'error');
          return false;
        }
        if (typeof file.text !== 'function') {
          showStatus('Bu tarayıcı seçilen dosyayı okuyamıyor.', 'error');
          return false;
        }
        let text;
        try {
          text = normalizeFileText(await file.text());
        } catch {
          showStatus(`${safeFileName(file?.name)} okunamadı.`, 'error');
          return false;
        }
        if (currentGeneration !== generation) return false;
        if (text === null) return false;
        next.push(Object.freeze({ name: safeFileName(file.name), size: Number(file.size), text }));
      }
      if (currentGeneration !== generation) return false;
      staged = next;
      renderReview();
      review?.querySelector?.('.text-file-import-confirm')?.focus?.();
      return true;
    }

    function confirmStaged() {
      const { composerInput } = nodes();
      if (!staged.length || !composerInput || isStreaming()) return false;
      const imports = staged.map((entry) => formatImport(entry.name, entry.text));
      const next = composeNextValue(composerInput.value, imports);
      if (!next) {
        showStatus('Seçilen dosyalar yazarın 12.000 karakter sınırına sığmıyor.', 'error');
        return false;
      }
      const count = staged.length;
      composerInput.value = next;
      dispatchComposerInput(composerInput);
      clearStaged();
      composerInput.focus?.();
      if (typeof composerInput.setSelectionRange === 'function') {
        try { composerInput.setSelectionRange(next.length, next.length); } catch { /* unsupported */ }
      }
      showStatus(`${count} dosya yazara eklendi. Mesajı göndermek için ayrıca sen onaylamalısın.`, 'success');
      return true;
    }

    function onAttachClick(event) {
      const { button } = nodes();
      if (!button || event?.currentTarget !== button) return false;
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
      if (isStreaming()) {
        showStatus('Yanıt sürerken dosya seçilemez.', 'error');
        return false;
      }
      input?.click?.();
      return true;
    }

    function onInputChange() {
      const files = Array.from(input?.files || []);
      if (input) input.value = '';
      if (files.length) void stageFiles(files);
    }

    function onKeydown(event) {
      if (event?.key !== 'Escape' || !staged.length) return;
      event.preventDefault?.();
      clearStaged({ focusButton: true });
      showStatus('Dosya ekleme iptal edildi.', 'idle');
    }

    function mount() {
      if (mounted) return true;
      const { button, composer } = nodes();
      if (!button || !composer || !documentRef.body) return false;
      input = installInput(documentRef);
      status = installStatus(documentRef, button);
      review = installReview(documentRef, composer);
      if (!input || !status || !review) return false;
      button.setAttribute?.('title', `En fazla ${MAX_FILES} küçük metin veya kod dosyası ekle`);
      button.setAttribute?.('aria-describedby', STATUS_ID);
      button.addEventListener?.('click', onAttachClick, true);
      input.addEventListener?.('change', onInputChange);
      review.querySelector?.('.text-file-import-confirm')?.addEventListener?.('click', confirmStaged);
      review.querySelector?.('.text-file-import-cancel')?.addEventListener?.('click', () => clearStaged({ focusButton: true }));
      review.querySelector?.('.text-file-import-close')?.addEventListener?.('click', () => clearStaged({ focusButton: true }));
      documentRef.addEventListener?.('keydown', onKeydown);
      mounted = true;
      return true;
    }

    function destroy() {
      if (!mounted) return;
      const { button } = nodes();
      generation += 1;
      button?.removeEventListener?.('click', onAttachClick, true);
      input?.removeEventListener?.('change', onInputChange);
      documentRef.removeEventListener?.('keydown', onKeydown);
      input?.remove?.();
      review?.remove?.();
      status?.remove?.();
      if (hideTimer !== null) clearTimeoutImpl(hideTimer);
      hideTimer = null;
      staged = [];
      input = null;
      review = null;
      status = null;
      mounted = false;
    }

    return Object.freeze({
      mount,
      destroy,
      stageFiles,
      confirmStaged,
      clearStaged,
      onAttachClick,
      snapshot: () => Object.freeze({ mounted, stagedCount: staged.length })
    });
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
    MAX_FILES,
    MAX_COMPOSER_CHARS,
    MAX_PREVIEW_CHARS,
    INPUT_ID,
    STATUS_ID,
    REVIEW_ID,
    ALLOWED_EXTENSIONS,
    MIME_ALLOWLIST,
    safeFileName,
    fileExtension,
    isAllowedFile,
    normalizeFileText,
    formatImport,
    composeNextValue,
    previewText,
    normalizeSelection,
    createController,
    mount
  });
});
