(function installHafizeMarkdownTools(root) {
  'use strict';
  const CARD = '#messages';
  const MAX_COPY = 24000;
  const COLLAPSE_LINES = 22;
  let installed = false;
  let observer = null;
  const state = new WeakMap();

  const makeButton = (doc, label, action) => {
    const node = doc.createElement('button');
    node.type = 'button';
    node.className = 'markdown-code-action';
    node.textContent = label;
    node.dataset.markdownCodeAction = action;
    return node;
  };

  function setStatus(pre, message) {
    const status = pre.querySelector('.markdown-code-status');
    if (!status) return;
    status.textContent = message;
    root.clearTimeout?.(state.get(pre)?.timer);
    const timer = root.setTimeout?.(() => { status.textContent = ''; }, 2200);
    state.set(pre, { ...(state.get(pre) || {}), timer });
  }

  async function copyCode(pre) {
    const code = pre.querySelector('code');
    if (!code) return;
    const text = (code.textContent || '').slice(0, MAX_COPY);
    try {
      if (!root.navigator?.clipboard?.writeText) throw new Error('CLIPBOARD_UNAVAILABLE');
      await root.navigator.clipboard.writeText(text);
      setStatus(pre, 'Kod kopyalandı.');
    } catch {
      setStatus(pre, 'Kod panoya kopyalanamadı.');
    }
  }

  function toggleCode(pre, toggle) {
    const current = pre.dataset.markdownCollapsed === 'true';
    pre.dataset.markdownCollapsed = String(!current);
    const code = pre.querySelector('code');
    if (code) code.classList.toggle('is-collapsed', !current);
    toggle.textContent = current ? 'Kodu daralt' : 'Kodu aç';
    toggle.setAttribute('aria-expanded', String(current));
  }

  function enhancePre(pre) {
    if (!pre || pre.querySelector('.markdown-code-toolbar')) return;
    const toolbar = root.document.createElement('div');
    toolbar.className = 'markdown-code-toolbar';
    const language = pre.querySelector('code')?.dataset.language;
    if (language) {
      const badge = root.document.createElement('span');
      badge.className = 'markdown-code-language'; badge.textContent = language;
      toolbar.append(badge);
    }
    const status = root.document.createElement('span');
    status.className = 'markdown-code-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const copy = makeButton(root.document, 'Kopyala', 'copy');
    toolbar.append(status, copy);

    const codeLines = (pre.querySelector('code')?.textContent || '').split('\n').length;
    let toggle = null;
    if (codeLines > COLLAPSE_LINES) {
      toggle = makeButton(root.document, 'Kodu daralt', 'toggle');
      toggle.setAttribute('aria-expanded', 'true');
      toolbar.append(toggle);
    }
    pre.prepend(toolbar);
    if (codeLines > COLLAPSE_LINES) {
      pre.dataset.markdownCollapsed = 'false';
      pre.querySelector('code')?.classList.add('is-long');
    }
    copy.addEventListener('click', () => copyCode(pre));
    toggle?.addEventListener('click', () => toggleCode(pre, toggle));
  }

  function scan() {
    const messages = root.document?.querySelector?.(CARD);
    if (!messages) return;
    messages.querySelectorAll('.message.assistant .content pre').forEach(enhancePre);
  }

  function install() {
    if (installed || !root.document) return false;
    const messages = root.document.querySelector(CARD);
    if (!messages) return false;
    installed = true;
    observer = typeof MutationObserver === 'function' ? new MutationObserver(scan) : null;
    observer?.observe(messages, { childList: true, subtree: true });
    scan();
    root.addEventListener('beforeunload', () => observer?.disconnect?.(), { once: true });
    return true;
  }

  let retry = 0;
  function wait() {
    if (install()) return;
    if (retry >= 12) return;
    retry += 1;
    root.setTimeout?.(wait, 50 * retry);
  }
  wait();
})(typeof globalThis !== 'undefined' ? globalThis : self);
