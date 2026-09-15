(function installHafizeMessageActions(root) {
  'use strict';
  const MESSAGE_LIMIT = 32000;
  const COLLAPSE_CHARS = 7000;
  const ACTION = 'data-message-action';
  let installed = false;
  let observer = null;

  const button = (doc, label, action) => {
    const node = doc.createElement('button'); node.type = 'button'; node.className = 'message-action';
    node.textContent = label; node.dataset.messageAction = action; node.setAttribute('aria-label', label); return node;
  };
  function getArticle(target) { return target?.closest?.('.message.assistant'); }
  function getSource(article) { const content = article?.querySelector?.('.content'); return content?.getAttribute?.('data-markdown-source') || content?.textContent || ''; }
  function showStatus(article, message) {
    let status = article?.querySelector?.('.message-action-status');
    if (!status) {
      status = root.document.createElement('span'); status.className = 'message-action-status';
      status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
      article?.querySelector?.('.message-actions')?.append(status);
    }
    if (!status) return;
    status.textContent = String(message || '').slice(0, 120);
    root.clearTimeout?.(status.__timer); status.__timer = root.setTimeout?.(() => { status.textContent = ''; }, 2200);
  }
  async function copy(article) {
    const text = getSource(article).slice(0, MESSAGE_LIMIT);
    try { if (!root.navigator?.clipboard?.writeText) throw new Error('CLIPBOARD'); await root.navigator.clipboard.writeText(text); showStatus(article, 'Yanıt kopyalandı.'); }
    catch { showStatus(article, 'Yanıt kopyalanamadı.'); }
  }
  function download(article) {
    const source = getSource(article).slice(0, MESSAGE_LIMIT); if (!source) return showStatus(article, 'İndirilecek yanıt yok.');
    try {
      const blob = new Blob([source], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob); const link = root.document.createElement('a');
      link.href = url; link.download = 'hafize-yanit.md'; link.click();
      root.setTimeout?.(() => URL.revokeObjectURL(url), 0); showStatus(article, 'Markdown dosyası oluşturuldu.');
    } catch { showStatus(article, 'Yanıt dosyaya aktarılamadı.'); }
  }
  function toggleRaw(article, toggle) {
    const content = article.querySelector('.content'); if (!content) return;
    const raw = toggle.getAttribute('aria-pressed') !== 'true';
    if (raw) { content.replaceChildren(root.document.createTextNode(getSource(article).slice(0, MESSAGE_LIMIT))); toggle.textContent = 'Biçimli görünüm'; }
    else if (root.HafizeMarkdown) { const rendered = root.HafizeMarkdown.render(root.document, getSource(article)); content.replaceChildren(...rendered.childNodes); toggle.textContent = 'Ham metin'; }
    toggle.setAttribute('aria-pressed', String(raw));
  }
  function toggleLong(article, toggle) {
    const content = article.querySelector('.content'); if (!content) return;
    const collapsed = toggle.getAttribute('aria-expanded') !== 'true';
    content.classList.toggle('message-content-collapsed', !collapsed);
    toggle.textContent = collapsed ? 'Yanıtı daralt' : 'Yanıtı aç'; toggle.setAttribute('aria-expanded', String(collapsed));
  }
  function enhance(article) {
    if (!article || article.querySelector('.message-actions')) return;
    const content = article.querySelector('.content'); if (!content) return;
    const actions = root.document.createElement('div'); actions.className = 'message-actions';
    actions.append(button(root.document, 'Kopyala', 'copy'), button(root.document, 'İndir', 'download'));
    const raw = button(root.document, 'Ham metin', 'raw'); raw.setAttribute('aria-pressed', 'false'); actions.append(raw);
    if (getSource(article).length > COLLAPSE_CHARS) { const collapse = button(root.document, 'Yanıtı daralt', 'collapse'); collapse.setAttribute('aria-expanded', 'true'); actions.append(collapse); }
    content.after(actions);
  }
  function scan() { root.document?.querySelectorAll?.('#messages .message.assistant').forEach(enhance); }
  function onClick(event) {
    const target = event.target?.closest?.(`[${ACTION}]`); if (!target) return;
    const article = getArticle(target); const action = target.dataset.messageAction; if (!article) return;
    if (action === 'copy') copy(article); else if (action === 'download') download(article); else if (action === 'raw') toggleRaw(article, target); else if (action === 'collapse') toggleLong(article, target);
  }
  function install() {
    if (installed || !root.document) return false; const messages = root.document.getElementById('messages'); if (!messages) return false;
    installed = true; messages.addEventListener('click', onClick); observer = typeof MutationObserver === 'function' ? new MutationObserver(scan) : null;
    observer?.observe(messages, { childList: true, subtree: true }); scan(); root.addEventListener('beforeunload', () => observer?.disconnect?.(), { once: true }); return true;
  }
  let retry = 0; function wait() { if (install()) return; if (retry >= 12) return; retry += 1; root.setTimeout?.(wait, 50 * retry); }
  wait();
})(typeof globalThis !== 'undefined' ? globalThis : self);
