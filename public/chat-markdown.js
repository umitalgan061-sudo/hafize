(function exposeHafizeChatMarkdown(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) module.exports = api;
  else root.HafizeChatMarkdown = api;
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeChatMarkdown() {
  'use strict';

  const LIMITS = Object.freeze({
    maxInput: 64_000,
    maxBlocks: 350,
    maxListItems: 240,
    maxTableRows: 120,
    maxTableColumns: 16,
    maxInline: 4_000,
    maxLinkText: 240,
    maxLinkHref: 500,
    maxLanguage: 24,
    maxHeading: 2_000,
    maxCodeLines: 2_000
  });
  const SAFE_PROTOCOLS = Object.freeze(['http:', 'https:', 'mailto:']);
  const LANGUAGE_PATTERN = /^[a-z0-9][a-z0-9+#._-]{0,23}$/i;
  const FENCE = /^\s{0,3}(`{3,}|~{3,})\s*([^\s`~]*)\s*$/;
  const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
  const BULLET = /^\s{0,3}[-*+]\s+(.+)$/;
  const ORDERED = /^\s{0,3}(\d{1,3})[.)]\s+(.+)$/;
  const QUOTE = /^\s{0,3}>\s?(.*)$/;
  const RULE = /^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/;
  const TABLE_SEPARATOR = /^:?-{3,}:?$/;
  const INLINE = /(`+)([\s\S]*?)\1|\[([^\]\n]{1,240})\]\(([^()\s]{1,500})\)|(https?:\/\/[^\s<>]{3,500})|(\*\*|__)(?=\S)([\s\S]*?\S)\6|(?<!\w)(\*|_)(?=\S)([\s\S]*?\S)\8|~~(?=\S)([\s\S]*?\S)~~/g;

  function normalizeInput(value) {
    if (typeof value !== 'string') return '';
    return value.slice(0, LIMITS.maxInput).replace(/\r\n?/g, '\n').replace(/\0/g, '');
  }

  function safeLinkHref(value) {
    const href = typeof value === 'string' ? value.trim() : '';
    if (!href || href.length > LIMITS.maxLinkHref) return '';
    try {
      const url = new URL(href);
      return SAFE_PROTOCOLS.includes(url.protocol) ? url.href : '';
    } catch {
      return '';
    }
  }

  function normalizeLanguage(value) {
    const language = typeof value === 'string' ? value.trim().slice(0, LIMITS.maxLanguage) : '';
    return LANGUAGE_PATTERN.test(language) ? language.toLowerCase() : '';
  }

  function span(type, text, extra = {}) {
    return Object.freeze({ type, text: String(text ?? ''), ...extra });
  }

  function scanInline(source) {
    if (typeof source !== 'string') return Object.freeze([]);
    if (source.length > LIMITS.maxInline) return Object.freeze([span('text', source)]);
    INLINE.lastIndex = 0;
    const spans = [];
    let cursor = 0;
    for (let match = INLINE.exec(source); match; match = INLINE.exec(source)) {
      if (match.index > cursor) spans.push(span('text', source.slice(cursor, match.index)));
      const raw = match[0];
      if (match[2] !== undefined) {
        spans.push(span('code', match[2].trim()));
      } else if (match[3] !== undefined) {
        const href = safeLinkHref(match[4]);
        spans.push(href ? span('link', match[3], { href }) : span('text', raw));
      } else if (match[5] !== undefined) {
        const href = safeLinkHref(match[5]);
        spans.push(href ? span('link', match[5], { href }) : span('text', raw));
      } else if (match[7] !== undefined) {
        spans.push(span('strong', match[7]));
      } else if (match[9] !== undefined) {
        spans.push(span('emphasis', match[9]));
      } else if (match[10] !== undefined) {
        spans.push(span('strike', match[10]));
      }
      cursor = match.index + raw.length;
    }
    if (cursor < source.length) spans.push(span('text', source.slice(cursor)));
    return Object.freeze(spans.filter((item) => item.text !== ''));
  }

  function splitTableRow(line) {
    const trimmed = line.trim();
    const body = trimmed.startsWith('|') ? trimmed.slice(1) : trimmed;
    const clean = body.endsWith('|') ? body.slice(0, -1) : body;
    const cells = [];
    let buffer = '';
    let escaped = false;
    let code = false;
    for (const char of clean) {
      if (escaped) {
        buffer += char;
        escaped = false;
      } else if (char === '\\') {
        buffer += char;
        escaped = true;
      } else if (char === '`') {
        code = !code;
        buffer += char;
      } else if (char === '|' && !code) {
        cells.push(buffer.trim());
        buffer = '';
      } else {
        buffer += char;
      }
    }
    cells.push(buffer.trim());
    return cells.slice(0, LIMITS.maxTableColumns);
  }

  function isTableStart(lines, index) {
    if (index + 1 >= lines.length) return false;
    const headers = splitTableRow(lines[index]);
    const separators = splitTableRow(lines[index + 1]);
    return headers.length >= 2 && headers.length === separators.length && separators.every((cell) => TABLE_SEPARATOR.test(cell));
  }

  function parseTable(lines, index) {
    const headers = splitTableRow(lines[index]);
    const separators = splitTableRow(lines[index + 1]);
    const align = separators.map((cell) => {
      const value = cell.trim();
      if (value.startsWith(':') && value.endsWith(':')) return 'center';
      return value.endsWith(':') ? 'right' : 'left';
    });
    const rows = [];
    let cursor = index + 2;
    while (cursor < lines.length && lines[cursor].trim() && lines[cursor].includes('|') && rows.length < LIMITS.maxTableRows) {
      rows.push(splitTableRow(lines[cursor]));
      cursor += 1;
    }
    return { block: Object.freeze({ type: 'table', headers, align, rows: Object.freeze(rows) }), next: cursor };
  }

  function parseMarkdown(value) {
    const lines = normalizeInput(value).split('\n');
    const blocks = [];
    let paragraph = [];
    let quote = [];
    let list = null;

    const flushParagraph = () => {
      if (!paragraph.length) return;
      blocks.push(Object.freeze({ type: 'paragraph', spans: scanInline(paragraph.join(' ')) }));
      paragraph = [];
    };
    const flushQuote = () => {
      if (!quote.length) return;
      blocks.push(Object.freeze({ type: 'quote', spans: scanInline(quote.join(' ')) }));
      quote = [];
    };
    const flushList = () => {
      if (!list?.items.length) return;
      blocks.push(Object.freeze({ type: 'list', ordered: list.ordered, start: list.start, items: Object.freeze(list.items.slice()) }));
      list = null;
    };
    const flushAll = () => { flushParagraph(); flushQuote(); flushList(); };

    for (let index = 0; index < lines.length && blocks.length < LIMITS.maxBlocks; index += 1) {
      const line = lines[index];
      const fence = FENCE.exec(line);
      if (fence) {
        flushAll();
        const marker = fence[1][0];
        const body = [];
        const language = normalizeLanguage(fence[2]);
        let closed = false;
        index += 1;
        for (; index < lines.length && body.length < LIMITS.maxCodeLines; index += 1) {
          const closing = FENCE.exec(lines[index]);
          if (closing && closing[1][0] === marker && !closing[2]) { closed = true; break; }
          body.push(lines[index]);
        }
        blocks.push(Object.freeze({ type: 'code', language, text: body.join('\n'), closed }));
        continue;
      }
      if (!line.trim()) { flushAll(); continue; }
      if (isTableStart(lines, index)) {
        flushAll();
        const table = parseTable(lines, index);
        blocks.push(table.block);
        index = table.next - 1;
        continue;
      }
      const heading = HEADING.exec(line);
      if (heading) {
        flushAll();
        blocks.push(Object.freeze({ type: 'heading', level: Math.min(heading[1].length, 3), spans: scanInline(heading[2].slice(0, LIMITS.maxHeading)) }));
        continue;
      }
      if (RULE.test(line)) { flushAll(); blocks.push(Object.freeze({ type: 'rule' })); continue; }
      const quoted = QUOTE.exec(line);
      if (quoted) { flushParagraph(); flushList(); quote.push(quoted[1]); continue; }
      flushQuote();
      const bullet = BULLET.exec(line);
      const ordered = bullet ? null : ORDERED.exec(line);
      if (bullet || ordered) {
        flushParagraph();
        const orderedMode = Boolean(ordered);
        if (list && list.ordered !== orderedMode) flushList();
        if (!list) list = { ordered: orderedMode, start: orderedMode ? Number(ordered[1]) : 1, items: [] };
        const text = bullet ? bullet[1] : ordered[2];
        const task = /^(\[[ xX]\])\s+(.+)$/.exec(text);
        if (task) list.items.push(Object.freeze({ task: true, checked: task[1].toLowerCase() === '[x]', spans: scanInline(task[2]) }));
        else if (list.items.length < LIMITS.maxListItems) list.items.push(Object.freeze({ task: false, checked: false, spans: scanInline(text) }));
        continue;
      }
      flushList();
      paragraph.push(line.trim());
    }
    flushAll();
    return Object.freeze(blocks.slice(0, LIMITS.maxBlocks));
  }

  function createElement(doc, tag, text, className = '') {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function appendInline(doc, parent, spans) {
    for (const item of spans) {
      if (item.type === 'link') {
        const link = createElement(doc, 'a', item.text, 'md-link');
        link.href = item.href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer nofollow';
        parent.append(link);
      } else if (item.type === 'code') parent.append(createElement(doc, 'code', item.text, 'md-inline-code'));
      else if (item.type === 'strong') parent.append(createElement(doc, 'strong', item.text));
      else if (item.type === 'emphasis') parent.append(createElement(doc, 'em', item.text));
      else if (item.type === 'strike') parent.append(createElement(doc, 'del', item.text));
      else parent.append(createElement(doc, 'span', item.text));
    }
  }

  function renderCode(doc, block, labels) {
    const wrapper = createElement(doc, 'div', undefined, 'md-code');
    const head = createElement(doc, 'div', undefined, 'md-code-head');
    head.append(createElement(doc, 'span', block.language || labels.code, 'md-code-lang'));
    const button = createElement(doc, 'button', labels.copy, 'md-code-copy');
    button.type = 'button';
    button.setAttribute('aria-label', labels.copyAria);
    head.append(button);
    const pre = doc.createElement('pre');
    pre.append(createElement(doc, 'code', block.text, block.language ? `language-${block.language}` : ''));
    wrapper.append(head, pre);
    return wrapper;
  }

  function renderList(doc, block) {
    const list = doc.createElement(block.ordered ? 'ol' : 'ul');
    list.className = 'md-list';
    if (block.ordered && block.start > 1) list.start = block.start;
    for (const item of block.items) {
      const entry = doc.createElement('li');
      if (item.task) {
        entry.className = 'md-task-item';
        const marker = createElement(doc, 'span', item.checked ? '✓' : '○', 'md-task-marker');
        marker.setAttribute('aria-hidden', 'true');
        entry.append(marker);
      }
      appendInline(doc, entry, item.spans);
      list.append(entry);
    }
    return list;
  }

  function renderTable(doc, block) {
    const wrap = createElement(doc, 'div', undefined, 'md-table-wrap');
    const table = createElement(doc, 'table', undefined, 'md-table');
    const head = doc.createElement('thead');
    const headRow = doc.createElement('tr');
    block.headers.forEach((value, index) => {
      const cell = doc.createElement('th');
      appendInline(doc, cell, scanInline(value));
      cell.style.textAlign = block.align[index] || 'left';
      headRow.append(cell);
    });
    head.append(headRow);
    const body = doc.createElement('tbody');
    for (const row of block.rows) {
      const tr = doc.createElement('tr');
      for (let index = 0; index < block.headers.length; index += 1) {
        const cell = doc.createElement('td');
        appendInline(doc, cell, scanInline(row[index] || ''));
        cell.style.textAlign = block.align[index] || 'left';
        tr.append(cell);
      }
      body.append(tr);
    }
    table.append(head, body);
    wrap.append(table);
    return wrap;
  }

  function renderBlock(doc, block, labels) {
    if (block.type === 'code') return renderCode(doc, block, labels);
    if (block.type === 'table') return renderTable(doc, block);
    if (block.type === 'rule') return doc.createElement('hr');
    if (block.type === 'list') return renderList(doc, block);
    const tag = block.type === 'heading' ? `h${block.level + 2}` : block.type === 'quote' ? 'blockquote' : 'p';
    const node = doc.createElement(tag);
    node.className = block.type === 'heading' ? 'md-heading' : block.type === 'quote' ? 'md-quote' : 'md-paragraph';
    appendInline(doc, node, block.spans);
    return node;
  }

  const DEFAULT_LABELS = Object.freeze({ code: 'kod', copy: 'Kopyala', copied: 'Kopyalandı', copyAria: 'Kod bloğunu kopyala' });

  function renderMarkdown(container, value, options = {}) {
    const doc = options.document || container?.ownerDocument || globalThis.document;
    if (!container || !doc?.createElement) return container;
    const blocks = parseMarkdown(value);
    const labels = { ...DEFAULT_LABELS, ...(options.labels || {}) };
    const nodes = blocks.length ? blocks.map((block) => renderBlock(doc, block, labels)) : [createElement(doc, 'p', options.placeholder || '…')];
    container.replaceChildren(...nodes);
    if (container.dataset) container.dataset.markdownRendered = 'true';
    return container;
  }

  function copyCode(button, clipboard = globalThis.navigator?.clipboard) {
    const code = button?.closest?.('.md-code')?.querySelector?.('pre')?.textContent || '';
    if (!code) return Promise.reject(new Error('EMPTY_CODE'));
    if (!clipboard?.writeText) return Promise.reject(new Error('CLIPBOARD_UNAVAILABLE'));
    return clipboard.writeText(code).then(() => {
      button.textContent = DEFAULT_LABELS.copied;
      button.setAttribute('aria-label', DEFAULT_LABELS.copied);
      globalThis.setTimeout?.(() => {
        if (!button.isConnected) return;
        button.textContent = DEFAULT_LABELS.copy;
        button.setAttribute('aria-label', DEFAULT_LABELS.copyAria);
      }, 1400);
    });
  }

  function install(rootDocument = globalThis.document) {
    const messages = rootDocument?.querySelector?.('#messages');
    if (!messages || !globalThis.MutationObserver || messages.dataset.markdownObserverInstalled === 'true') return { disconnect() {} };
    messages.dataset.markdownObserverInstalled = 'true';
    let queued = false;
    const scan = () => {
      queued = false;
      for (const content of messages.querySelectorAll('.message.assistant .content')) {
        const source = content.textContent || '';
        if (!source || content.dataset.markdownSource === source || content.dataset.markdownWriting === 'true') continue;
        content.dataset.markdownSource = source;
        content.dataset.markdownRaw = source;
        content.dataset.markdownWriting = 'true';
        renderMarkdown(content, source, { document: rootDocument });
        content.dataset.markdownWriting = 'false';
      }
    };
    const schedule = () => {
      if (queued) return;
      queued = true;
      if (typeof globalThis.queueMicrotask === 'function') globalThis.queueMicrotask(scan);
      else globalThis.setTimeout(scan, 0);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(messages, { subtree: true, childList: true, characterData: true });
    messages.addEventListener('click', (event) => {
      const button = event.target?.closest?.('.md-code-copy');
      if (!button) return;
      copyCode(button).catch(() => undefined);
    });
    scan();
    return Object.freeze({ disconnect() { observer.disconnect(); } });
  }

  return Object.freeze({ LIMITS, SAFE_PROTOCOLS, DEFAULT_LABELS, normalizeInput, normalizeLanguage, safeLinkHref, scanInline, splitTableRow, parseMarkdown, renderMarkdown, copyCode, install });
});
