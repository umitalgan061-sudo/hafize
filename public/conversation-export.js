(function exposeHafizeConversationExport(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeConversationExport = api;
  api.mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeConversationExport() {
  'use strict';

  const MAX_MESSAGES = 500;
  const MAX_MESSAGE_CHARS = 256 * 1024;
  const MAX_EXPORT_CHARS = 1024 * 1024;
  const MAX_TITLE_CHARS = 80;
  const BUTTON_ID = 'conversationExportBtn';
  const DIALOG_ID = 'conversationExportDialog';
  const STYLE_ID = 'hafize-conversation-export-style';
  const STYLE_TEXT = `
.conversation-export-trigger{border:1px solid var(--line,#ddd);border-radius:10px;background:transparent;color:inherit;padding:6px 9px;font:inherit;font-size:12px;font-weight:650;cursor:pointer;white-space:nowrap}
.conversation-export-trigger:hover,.conversation-export-trigger:focus-visible{background:color-mix(in srgb,var(--surface,#fff) 88%,transparent)}
.conversation-export-trigger:focus-visible,.conversation-export-option:focus-visible,.conversation-export-cancel:focus-visible{outline:2px solid var(--accent,#d97706);outline-offset:2px}
.conversation-export-backdrop{position:fixed;inset:0;z-index:95;display:grid;place-items:center;padding:18px;background:rgba(0,0,0,.38);backdrop-filter:blur(3px)}
.conversation-export-backdrop[hidden]{display:none}
.conversation-export-dialog{width:min(440px,100%);border:1px solid var(--line,#ddd);border-radius:16px;background:var(--surface,#fff);color:inherit;padding:18px;box-shadow:0 20px 60px rgba(0,0,0,.22)}
.conversation-export-dialog h2{margin:0 0 6px;font-size:18px}
.conversation-export-dialog p{margin:0;color:var(--muted,#777);font-size:13px;line-height:1.45}
.conversation-export-options{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:16px 0 12px}
.conversation-export-option,.conversation-export-cancel{border:1px solid var(--line,#ddd);border-radius:12px;background:transparent;color:inherit;padding:11px 12px;font:inherit;cursor:pointer;text-align:left}
.conversation-export-option strong{display:block;font-size:13px}.conversation-export-option span{display:block;margin-top:3px;color:var(--muted,#777);font-size:11px}
.conversation-export-option:hover,.conversation-export-option:focus-visible,.conversation-export-cancel:hover,.conversation-export-cancel:focus-visible{background:color-mix(in srgb,var(--surface,#fff) 82%,var(--line,#ddd))}
.conversation-export-footer{display:flex;align-items:center;justify-content:space-between;gap:12px}.conversation-export-status{min-height:18px;color:var(--muted,#777);font-size:12px}.conversation-export-status[data-state="error"]{font-weight:700}
.conversation-export-cancel{text-align:center;padding:7px 10px;font-size:12px}
@media(max-width:720px){.conversation-export-trigger{padding:6px 8px;font-size:0}.conversation-export-trigger::before{content:'⇩';font-size:17px}.conversation-export-options{grid-template-columns:1fr}.conversation-export-backdrop{align-items:end;padding:10px}.conversation-export-dialog{border-radius:16px 16px 12px 12px}}
`;

  function normalizeText(value) {
    if (typeof value !== 'string') return null;
    const text = value.replace(/\r\n?/g, '\n').replace(/\u0000/g, '');
    if (text.length > MAX_MESSAGE_CHARS) return null;
    return text;
  }

  function normalizeRole(value) {
    return value === 'user' || value === 'assistant' ? value : null;
  }

  function safeTitle(value) {
    if (typeof value !== 'string') return 'Hafize sohbeti';
    const normalized = value
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_TITLE_CHARS);
    return normalized || 'Hafize sohbeti';
  }

  function filenameStem(value) {
    const title = safeTitle(value)
      .normalize('NFKC')
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\.+$/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_TITLE_CHARS);
    return title || 'Hafize sohbeti';
  }

  function collectTranscript(messagesRoot) {
    if (!messagesRoot?.querySelectorAll) return null;
    const articles = Array.from(messagesRoot.querySelectorAll('.message')).slice(0, MAX_MESSAGES + 1);
    if (!articles.length || articles.length > MAX_MESSAGES) return null;
    const transcript = [];
    let total = 0;
    for (const article of articles) {
      const role = normalizeRole(article?.classList?.contains?.('user') ? 'user' : article?.classList?.contains?.('assistant') ? 'assistant' : '');
      const content = normalizeText(article?.querySelector?.('.content')?.textContent);
      if (!role || content === null) continue;
      total += content.length;
      if (total > MAX_EXPORT_CHARS) return null;
      transcript.push(Object.freeze({ role, content }));
    }
    return transcript.length ? Object.freeze(transcript) : null;
  }

  function markdownEscapeHeading(value) {
    return safeTitle(value).replace(/([\\`*_{}\[\]()#+.!|>~-])/g, '\\$1');
  }

  function markdownTranscript(title, transcript) {
    if (!Array.isArray(transcript) || !transcript.length) return null;
    const chunks = [`# ${markdownEscapeHeading(title)}`, ''];
    for (const entry of transcript) {
      const role = normalizeRole(entry?.role);
      const content = normalizeText(entry?.content);
      if (!role || content === null) return null;
      chunks.push(`## ${role === 'user' ? 'Sen' : 'Hafize'}`, '', content, '');
    }
    const text = `${chunks.join('\n').trimEnd()}\n`;
    return text.length <= MAX_EXPORT_CHARS ? text : null;
  }

  function plainTextTranscript(title, transcript) {
    if (!Array.isArray(transcript) || !transcript.length) return null;
    const chunks = [safeTitle(title), ''];
    for (const entry of transcript) {
      const role = normalizeRole(entry?.role);
      const content = normalizeText(entry?.content);
      if (!role || content === null) return null;
      chunks.push(`${role === 'user' ? 'Sen' : 'Hafize'}:`, content, '');
    }
    const text = `${chunks.join('\n').trimEnd()}\n`;
    return text.length <= MAX_EXPORT_CHARS ? text : null;
  }

  function buildExport({ title, transcript, format }) {
    const stem = filenameStem(title);
    if (format === 'markdown') {
      const content = markdownTranscript(title, transcript);
      return content === null ? null : Object.freeze({ content, filename: `${stem}.md`, type: 'text/markdown;charset=utf-8' });
    }
    if (format === 'text') {
      const content = plainTextTranscript(title, transcript);
      return content === null ? null : Object.freeze({ content, filename: `${stem}.txt`, type: 'text/plain;charset=utf-8' });
    }
    return null;
  }

  function activeTitle(documentRef) {
    const title = documentRef?.querySelector?.('.conversation-row.active .conversation-open')?.textContent;
    return safeTitle(title);
  }

  function installStyles(documentRef) {
    if (!documentRef?.head || documentRef.querySelector?.(`#${STYLE_ID}`)) return false;
    const style = documentRef.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLE_TEXT;
    documentRef.head.append(style);
    return true;
  }

  function createController({
    documentRef = globalThis.document,
    BlobImpl = globalThis.Blob,
    urlApi = globalThis.URL,
    setTimeoutImpl = globalThis.setTimeout,
    clearTimeoutImpl = globalThis.clearTimeout
  } = {}) {
    if (!documentRef?.querySelector || !documentRef?.createElement) throw new Error('INVALID_CONVERSATION_EXPORT_DOCUMENT');
    if (typeof setTimeoutImpl !== 'function' || typeof clearTimeoutImpl !== 'function') throw new Error('INVALID_CONVERSATION_EXPORT_TIMER');

    let trigger = null;
    let backdrop = null;
    let dialog = null;
    let status = null;
    let closeButton = null;
    let mounted = false;
    let statusTimer = null;
    let previousFocus = null;

    function setStatus(text, state = 'idle') {
      if (!status) return;
      if (statusTimer !== null) clearTimeoutImpl(statusTimer);
      statusTimer = null;
      status.textContent = text;
      status.dataset.state = state;
      if (text) statusTimer = setTimeoutImpl(() => {
        if (status) {
          status.textContent = '';
          status.dataset.state = 'idle';
        }
        statusTimer = null;
      }, 2600);
    }

    function focusableNodes() {
      return Array.from(dialog?.querySelectorAll?.('button:not([disabled])') || []);
    }

    function close({ restoreFocus = true } = {}) {
      if (!backdrop || backdrop.hidden) return false;
      backdrop.hidden = true;
      setStatus('');
      if (restoreFocus) previousFocus?.focus?.();
      previousFocus = null;
      return true;
    }

    function open() {
      if (!backdrop || !dialog) return false;
      previousFocus = documentRef.activeElement || trigger;
      backdrop.hidden = false;
      setStatus('');
      focusableNodes()[0]?.focus?.();
      return true;
    }

    function onKeydown(event) {
      if (!backdrop || backdrop.hidden) return;
      if (event?.key === 'Escape') {
        event.preventDefault?.();
        close();
        return;
      }
      if (event?.key !== 'Tab') return;
      const nodes = focusableNodes();
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && documentRef.activeElement === first) {
        event.preventDefault?.();
        last.focus?.();
      } else if (!event.shiftKey && documentRef.activeElement === last) {
        event.preventDefault?.();
        first.focus?.();
      }
    }

    function download(format) {
      const messages = documentRef.querySelector('#messages');
      const transcript = collectTranscript(messages);
      const payload = buildExport({ title: activeTitle(documentRef), transcript, format });
      if (!payload) {
        setStatus('Dışa aktarılacak güvenli sohbet bulunamadı.', 'error');
        return false;
      }
      if (typeof BlobImpl !== 'function' || typeof urlApi?.createObjectURL !== 'function' || typeof urlApi?.revokeObjectURL !== 'function') {
        setStatus('Dosya indirme bu tarayıcıda kullanılamıyor.', 'error');
        return false;
      }

      let href = '';
      let anchor = null;
      try {
        const blob = new BlobImpl([payload.content], { type: payload.type });
        href = urlApi.createObjectURL(blob);
        anchor = documentRef.createElement('a');
        anchor.href = href;
        anchor.download = payload.filename;
        anchor.rel = 'noopener';
        anchor.hidden = true;
        documentRef.body?.append?.(anchor);
        anchor.click?.();
        setStatus(`${format === 'markdown' ? 'Markdown' : 'Düz metin'} hazırlandı.`, 'success');
        setTimeoutImpl(() => close(), 180);
        return true;
      } catch {
        setStatus('Sohbet dışa aktarılamadı.', 'error');
        return false;
      } finally {
        anchor?.remove?.();
        if (href) urlApi.revokeObjectURL(href);
      }
    }

    function createTrigger() {
      const existing = documentRef.querySelector(`#${BUTTON_ID}`);
      if (existing) return existing;
      const topbar = documentRef.querySelector('.topbar');
      const themeToggle = documentRef.querySelector('#themeToggle');
      if (!topbar) return null;
      const button = documentRef.createElement('button');
      button.id = BUTTON_ID;
      button.type = 'button';
      button.className = 'conversation-export-trigger';
      button.textContent = 'Sohbeti dışa aktar';
      button.setAttribute('aria-haspopup', 'dialog');
      button.setAttribute('aria-controls', DIALOG_ID);
      if (themeToggle && typeof topbar.insertBefore === 'function') topbar.insertBefore(button, themeToggle);
      else topbar.append(button);
      return button;
    }

    function createDialog() {
      const existing = documentRef.querySelector(`#${DIALOG_ID}`)?.parentNode;
      if (existing) return existing;
      const layer = documentRef.createElement('div');
      layer.className = 'conversation-export-backdrop';
      layer.hidden = true;

      const panel = documentRef.createElement('section');
      panel.id = DIALOG_ID;
      panel.className = 'conversation-export-dialog';
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
      panel.setAttribute('aria-labelledby', `${DIALOG_ID}Title`);
      panel.setAttribute('aria-describedby', `${DIALOG_ID}Description`);

      const title = documentRef.createElement('h2');
      title.id = `${DIALOG_ID}Title`;
      title.textContent = 'Sohbeti dışa aktar';
      const description = documentRef.createElement('p');
      description.id = `${DIALOG_ID}Description`;
      description.textContent = 'Yalnız bu ekranda görünen Sen ve Hafize mesajları dosyaya alınır.';

      const options = documentRef.createElement('div');
      options.className = 'conversation-export-options';
      const markdown = documentRef.createElement('button');
      markdown.type = 'button';
      markdown.className = 'conversation-export-option';
      const markdownStrong = documentRef.createElement('strong');
      markdownStrong.textContent = 'Markdown (.md)';
      const markdownHint = documentRef.createElement('span');
      markdownHint.textContent = 'Başlıklar ve mesaj sırası korunur.';
      markdown.append(markdownStrong, markdownHint);
      markdown.addEventListener('click', () => download('markdown'));

      const text = documentRef.createElement('button');
      text.type = 'button';
      text.className = 'conversation-export-option';
      const textStrong = documentRef.createElement('strong');
      textStrong.textContent = 'Düz metin (.txt)';
      const textHint = documentRef.createElement('span');
      textHint.textContent = 'Her yerde açılabilen sade metin.';
      text.append(textStrong, textHint);
      text.addEventListener('click', () => download('text'));
      options.append(markdown, text);

      const footer = documentRef.createElement('div');
      footer.className = 'conversation-export-footer';
      const state = documentRef.createElement('span');
      state.className = 'conversation-export-status';
      state.dataset.state = 'idle';
      state.setAttribute('role', 'status');
      state.setAttribute('aria-live', 'polite');
      const cancel = documentRef.createElement('button');
      cancel.type = 'button';
      cancel.className = 'conversation-export-cancel';
      cancel.textContent = 'Vazgeç';
      cancel.addEventListener('click', () => close());
      footer.append(state, cancel);
      panel.append(title, description, options, footer);
      layer.append(panel);
      documentRef.body?.append?.(layer);
      dialog = panel;
      status = state;
      closeButton = cancel;
      return layer;
    }

    function onBackdropClick(event) {
      if (event?.target === backdrop) close();
    }

    function mount() {
      if (mounted) return true;
      if (!documentRef.body || !documentRef.querySelector('#messages')) return false;
      installStyles(documentRef);
      trigger = createTrigger();
      if (!trigger) return false;
      backdrop = createDialog();
      if (!backdrop || !dialog || !status || !closeButton) return false;
      trigger.addEventListener('click', open);
      backdrop.addEventListener('click', onBackdropClick);
      documentRef.addEventListener?.('keydown', onKeydown);
      mounted = true;
      return true;
    }

    function destroy() {
      if (!mounted) return;
      trigger?.removeEventListener?.('click', open);
      backdrop?.removeEventListener?.('click', onBackdropClick);
      documentRef.removeEventListener?.('keydown', onKeydown);
      if (statusTimer !== null) clearTimeoutImpl(statusTimer);
      statusTimer = null;
      backdrop?.remove?.();
      trigger?.remove?.();
      trigger = null;
      backdrop = null;
      dialog = null;
      status = null;
      closeButton = null;
      mounted = false;
    }

    return Object.freeze({ mount, destroy, open, close, download, onKeydown });
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
    MAX_MESSAGES,
    MAX_MESSAGE_CHARS,
    MAX_EXPORT_CHARS,
    MAX_TITLE_CHARS,
    BUTTON_ID,
    DIALOG_ID,
    STYLE_ID,
    normalizeText,
    normalizeRole,
    safeTitle,
    filenameStem,
    collectTranscript,
    markdownEscapeHeading,
    markdownTranscript,
    plainTextTranscript,
    buildExport,
    activeTitle,
    installStyles,
    createController,
    mount
  });
});
