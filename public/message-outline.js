(function installHafizeMessageOutline(root) {
  'use strict';
  const MIN_HEADINGS = 2;
  const MAX_HEADINGS = 20;
  const MAX_LABEL = 80;
  let installed = false;
  let observer = null;
  let counter = 0;

  const button = (doc, label, action) => {
    const node = doc.createElement('button'); node.type = 'button'; node.className = 'message-action';
    node.textContent = label; node.dataset.messageOutlineAction = action; node.setAttribute('aria-label', label); return node;
  };
  const slug = (value) => `${String(value || 'başlık').toLocaleLowerCase('tr-TR').replace(/[^a-z0-9çğıöşü]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'baslik'}-${counter++}`;
  function enhance(article) {
    if (!article || article.querySelector('.message-outline')) return;
    const content = article.querySelector('.markdown-body');
    if (!content) return;
    const headings = [...content.querySelectorAll('h1,h2,h3')].slice(0, MAX_HEADINGS);
    if (headings.length < MIN_HEADINGS) return;
    const outline = root.document.createElement('div'); outline.className = 'message-outline';
    const toggle = button(root.document, 'Başlık özeti', 'toggle'); toggle.setAttribute('aria-expanded', 'false');
    const list = root.document.createElement('nav'); list.className = 'message-outline-list'; list.hidden = true; list.setAttribute('aria-label', 'Yanıt başlıkları');
    headings.forEach((heading) => {
      if (!heading.id) heading.id = slug(heading.textContent);
      const link = root.document.createElement('a'); link.href = `#${heading.id}`;
      link.textContent = String(heading.textContent || '').trim().slice(0, MAX_LABEL); link.dataset.level = heading.tagName.toLowerCase();
      link.addEventListener('click', () => { list.hidden = true; toggle.setAttribute('aria-expanded', 'false'); }); list.append(link);
    });
    toggle.addEventListener('click', () => { const open = toggle.getAttribute('aria-expanded') !== 'true'; toggle.setAttribute('aria-expanded', String(open)); list.hidden = !open; });
    outline.append(toggle, list); article.querySelector('.content')?.after(outline);
  }
  function scan() { root.document?.querySelectorAll?.('#messages .message.assistant').forEach(enhance); }
  function install() {
    if (installed || !root.document) return false;
    const messages = root.document.getElementById('messages'); if (!messages) return false;
    installed = true; observer = typeof MutationObserver === 'function' ? new MutationObserver(scan) : null;
    observer?.observe(messages, { childList: true, subtree: true }); scan();
    root.addEventListener('beforeunload', () => observer?.disconnect?.(), { once: true }); return true;
  }
  let retry = 0; function wait() { if (install()) return; if (retry >= 12) return; retry += 1; root.setTimeout?.(wait, 50 * retry); }
  wait();
})(typeof globalThis !== 'undefined' ? globalThis : self);
