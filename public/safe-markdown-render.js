(function exposeHafizeSafeMarkdown(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeSafeMarkdown = api;
  api.mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeSafeMarkdown() {
  'use strict';

  const MAX_SOURCE_CHARS = 256 * 1024;
  const MARKER = 'hafizeMarkdownReady';
  const STYLE_ID = 'hafize-safe-markdown-style';
  const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);
  const STYLE_TEXT = `
.message.assistant .content.hafize-markdown{white-space:normal}
.hafize-markdown p{margin:.55em 0;white-space:pre-wrap}
.hafize-markdown p:first-child{margin-top:0}.hafize-markdown p:last-child{margin-bottom:0}
.hafize-markdown h1,.hafize-markdown h2,.hafize-markdown h3{margin:1em 0 .45em;line-height:1.25}
.hafize-markdown h1{font-size:1.25em}.hafize-markdown h2{font-size:1.15em}.hafize-markdown h3{font-size:1.07em}
.hafize-markdown ul,.hafize-markdown ol{margin:.55em 0;padding-inline-start:1.45em}
.hafize-markdown li{margin:.25em 0;white-space:pre-wrap}
.hafize-markdown blockquote{margin:.65em 0;padding:.15em 0 .15em .85em;border-left:3px solid var(--line,#ddd);color:var(--muted,#666)}
.hafize-markdown pre{overflow:auto;margin:.7em 0;padding:12px;border:1px solid var(--line,#ddd);border-radius:12px;background:color-mix(in srgb,var(--surface,#fff) 88%,#000 12%)}
.hafize-markdown code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.92em}
.hafize-markdown :not(pre)>code{padding:.12em .32em;border-radius:5px;background:color-mix(in srgb,var(--surface,#fff) 88%,#000 12%)}
.hafize-markdown a{text-decoration:underline;text-underline-offset:2px}
.hafize-markdown hr{border:0;border-top:1px solid var(--line,#ddd);margin:.9em 0}
`;

  function normalizedSource(value) {
    if (typeof value !== 'string') return null;
    const text = value.replace(/\r\n?/g, '\n');
    if (text.length > MAX_SOURCE_CHARS) return null;
    return text;
  }

  function safeHref(value, baseUrl = 'https://hafize.invalid/') {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      const url = new URL(value.trim(), baseUrl);
      return SAFE_PROTOCOLS.has(url.protocol) ? url.href : null;
    } catch {
      return null;
    }
  }

  function appendTextWithInline(documentRef, parent, text, baseUrl) {
    const pattern = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[[^\]\n]+\]\([^\s)]+\))/g;
    let cursor = 0;
    for (const match of text.matchAll(pattern)) {
      if (match.index > cursor) parent.append(documentRef.createTextNode(text.slice(cursor, match.index)));
      const token = match[0];
      if (token.startsWith('`')) {
        const code = documentRef.createElement('code');
        code.textContent = token.slice(1, -1);
        parent.append(code);
      } else if (token.startsWith('**')) {
        const strong = documentRef.createElement('strong');
        strong.textContent = token.slice(2, -2);
        parent.append(strong);
      } else if (token.startsWith('*')) {
        const em = documentRef.createElement('em');
        em.textContent = token.slice(1, -1);
        parent.append(em);
      } else {
        const boundary = token.lastIndexOf('](');
        const label = token.slice(1, boundary);
        const href = safeHref(token.slice(boundary + 2, -1), baseUrl);
        if (!href) {
          parent.append(documentRef.createTextNode(token));
        } else {
          const link = documentRef.createElement('a');
          link.textContent = label;
          link.href = href;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          parent.append(link);
        }
      }
      cursor = match.index + token.length;
    }
    if (cursor < text.length) parent.append(documentRef.createTextNode(text.slice(cursor)));
  }

  function parseBlocks(source) {
    const lines = source.split('\n');
    const blocks = [];
    let paragraph = [];
    let code = null;
    let list = null;

    function flushParagraph() {
      if (!paragraph.length) return;
      blocks.push({ type: 'paragraph', text: paragraph.join('\n') });
      paragraph = [];
    }
    function flushList() {
      if (!list) return;
      blocks.push(list);
      list = null;
    }

    for (const line of lines) {
      if (code) {
        if (/^```\s*$/.test(line)) {
          blocks.push(code);
          code = null;
        } else {
          code.lines.push(line);
        }
        continue;
      }
      const fence = line.match(/^```\s*([\w.+-]{0,32})\s*$/);
      if (fence) {
        flushParagraph(); flushList();
        code = { type: 'code', language: fence[1] || '', lines: [] };
        continue;
      }
      if (!line.trim()) {
        flushParagraph(); flushList();
        continue;
      }
      const heading = line.match(/^(#{1,3})\s+(.+)$/);
      if (heading) {
        flushParagraph(); flushList();
        blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
        continue;
      }
      if (/^\s*(?:---+|___+|\*\*\*+)\s*$/.test(line)) {
        flushParagraph(); flushList(); blocks.push({ type: 'hr' }); continue;
      }
      const quote = line.match(/^>\s?(.*)$/);
      if (quote) {
        flushParagraph(); flushList(); blocks.push({ type: 'quote', text: quote[1] }); continue;
      }
      const item = line.match(/^\s*([-*+] |(\d+)\. )(.+)$/);
      if (item) {
        flushParagraph();
        const ordered = Boolean(item[2]);
        if (!list || list.ordered !== ordered) { flushList(); list = { type: 'list', ordered, items: [] }; }
        list.items.push(item[3]);
        continue;
      }
      flushList();
      paragraph.push(line);
    }
    if (code) blocks.push(code);
    flushParagraph(); flushList();
    return blocks;
  }

  function renderSource(documentRef, source, { baseUrl } = {}) {
    const normalized = normalizedSource(source);
    if (normalized === null) return null;
    const fragment = documentRef.createDocumentFragment();
    for (const block of parseBlocks(normalized)) {
      if (block.type === 'code') {
        const pre = documentRef.createElement('pre');
        const code = documentRef.createElement('code');
        if (block.language) code.dataset.language = block.language;
        code.textContent = block.lines.join('\n');
        pre.append(code); fragment.append(pre); continue;
      }
      if (block.type === 'heading') {
        const heading = documentRef.createElement(`h${block.level}`);
        appendTextWithInline(documentRef, heading, block.text, baseUrl);
        fragment.append(heading); continue;
      }
      if (block.type === 'list') {
        const list = documentRef.createElement(block.ordered ? 'ol' : 'ul');
        for (const text of block.items) {
          const li = documentRef.createElement('li');
          appendTextWithInline(documentRef, li, text, baseUrl); list.append(li);
        }
        fragment.append(list); continue;
      }
      if (block.type === 'quote') {
        const quote = documentRef.createElement('blockquote');
        appendTextWithInline(documentRef, quote, block.text, baseUrl); fragment.append(quote); continue;
      }
      if (block.type === 'hr') { fragment.append(documentRef.createElement('hr')); continue; }
      const p = documentRef.createElement('p');
      appendTextWithInline(documentRef, p, block.text, baseUrl); fragment.append(p);
    }
    return fragment;
  }

  function installStyles(documentRef) {
    if (!documentRef?.head || documentRef.querySelector?.(`#${STYLE_ID}`)) return false;
    const style = documentRef.createElement('style');
    style.id = STYLE_ID; style.textContent = STYLE_TEXT; documentRef.head.append(style); return true;
  }

  function createController({ documentRef = globalThis.document, MutationObserverImpl = globalThis.MutationObserver } = {}) {
    if (!documentRef?.querySelector) throw new Error('INVALID_MARKDOWN_DOCUMENT');
    let observer = null;
    let rendering = false;

    function renderContent(content) {
      if (!content || content.dataset?.[MARKER] === '1') return false;
      const source = normalizedSource(content.textContent);
      if (source === null) return false;
      const fragment = renderSource(documentRef, source, { baseUrl: documentRef.baseURI });
      if (!fragment) return false;
      rendering = true;
      try {
        content.replaceChildren(fragment);
        content.classList?.add('hafize-markdown');
        content.dataset[MARKER] = '1';
      } finally { rendering = false; }
      return true;
    }

    function renderAll(root = documentRef) {
      const nodes = root.querySelectorAll?.('.message.assistant .content') || [];
      let count = 0;
      for (const node of nodes) if (renderContent(node)) count += 1;
      return count;
    }

    function mount() {
      const messages = documentRef.querySelector('#messages');
      if (!messages) return false;
      installStyles(documentRef); renderAll(messages);
      if (typeof MutationObserverImpl === 'function') {
        observer = new MutationObserverImpl((records) => {
          if (rendering) return;
          for (const record of records || []) {
            const content = record.target?.closest?.('.message.assistant .content');
            if (content && record.type === 'characterData') delete content.dataset[MARKER];
          }
          renderAll(messages);
        });
        observer.observe(messages, { childList: true, subtree: true, characterData: true });
      }
      return true;
    }
    function destroy() { observer?.disconnect?.(); observer = null; }
    return Object.freeze({ mount, destroy, renderContent, renderAll });
  }

  function mount(options) {
    try { const controller = createController(options); return controller.mount() ? controller : null; } catch { return null; }
  }

  return Object.freeze({ MAX_SOURCE_CHARS, MARKER, STYLE_ID, SAFE_PROTOCOLS, normalizedSource, safeHref, parseBlocks, renderSource, installStyles, createController, mount });
});