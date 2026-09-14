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
    maxHeadingText: 2_000,
    maxCodeLines: 2_000
  });
  const SAFE_PROTOCOLS = Object.freeze(['http:', 'https:', 'mailto:']);
  const LANGUAGE_PATTERN = /^[a-z0-9][a-z0-9+#._-]{0,23}$/i;
  const FENCE_PATTERN = /^\s{0,3}(`{3,}|~{3,})\s*([^\s`~]*)\s*$/;
  const HEADING_PATTERN = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
  const BULLET_PATTERN = /^\s{0,3}[-*+]\s+(.+)$/;
  const ORDERED_PATTERN = /^\s{0,3}(\d{1,3})[.)]\s+(.+)$/;
  const QUOTE_PATTERN = /^\s{0,3}>\s?(.*)$/;
  const RULE_PATTERN = /^\s{0,3}(?:(?:-{3,})|(?:\*{3,})|(?:_{3,}))\s*$/;
  const TABLE_SEPARATOR = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)+\|?\s*$/;
  const INLINE_PATTERN = /(`+)([\s\S]*?)\1|\[([^\]\n]{1,240})\]\(([^()\s]{1,500})\)|(https?:\/\/[^\s<>]{3,500})|(\*\*|__)(?=\S)([\s\S]*?\S)\6|(?<!\w)(\*|_)(?=\S)([\s\S]*?\S)\8|~~(?=\S)([\s\S]*?\S)~~/g;

  function normalizeInput(value) {
    if (typeof value !== 'string') return '';
    return value.slice(0, LIMITS.maxInput).replace(/\r\n?/g, '\n').replace(/\0/g, '');
  }

  function safeLinkHref(value) {
    const href = typeof value === 'string' ? value.trim() : '';
    if (!href || href.length > LIMITS.maxLinkHref) return '';
    try {
      const parsed = new URL(href);
      return SAFE_PROTOCOLS.includes(parsed.protocol) ? parsed.href : '';
    } catch {
      return '';
    }
  }

  function normalizeLanguage(value) {
    const language = typeof value === 'string' ? value.trim().slice(0, LIMITS.maxLanguage) : '';
    return LANGUAGE_PATTERN.test(language) ? language.toLowerCase() : '';
  }

  function textNode(text) {
    return Object.freeze({ type: 'text', text: String(text ?? '') });
  }

  function scanInline(source) {
    if (source.length > LIMITS.maxInline) return Object.freeze([textNode(source)]);
    const spans = [];
    let cursor = 0;
    INLINE_PATTERN.lastIndex = 0;
    for (let match = INLINE_PATTERN.exec(source); match; match = INLINE_PATTERN.exec(source)) {
      if (match.index > cursor) spans.push(textNode(source.slice(cursor, match.index)));
      const raw = match[0];
      if (match[2] !== undefined) {
        spans.push(Object.freeze({ type: 'code', text: match[2].trim() }));
      } else if (match[3] !== undefined) {
        const href = safeLinkHref(match[4]);
        spans.push(href
          ? Object.freeze({ type: 'link', text: match[3].slice(0, LIMITS.maxLinkText), href })
          : textNode(raw));
      } else if (match[5] !== undefined) {
        const href = safeLinkHref(match[5]);
        spans.push(href
          ? Object.freeze({ type: 'link', text: match[5], href })
          : textNode(raw));
      } else if (match[7] !== undefined) {
        spans.push(Object.freeze({ type: 'strong', text: match[7] }));
      } else if (match[9] !== undefined) {
        spans.push(Object.freeze({ type: 'emphasis', text: match[9] }));
      } else if (match[10] !== undefined) {
        spans.push(Object.freeze({ type: 'strike', text: match[10] }));
      } else {
        spans.push(textNode(raw));
      }
      cursor = match.index + raw.length;
    }
    if (cursor < source.length) spans.push(textNode(source.slice(cursor)));
    return Object.freeze(spans.filter((span) => span.text !== ''));
  }

  function splitTableRow(line) {
    const trimmed = line.trim();
    const withoutEdges = trimmed.startsWith('|') ? trimmed.slice(1) : trimmed;
    const body = withoutEdges.endsWith('|') ? withoutEdges.slice(0, -1) : withoutEdges;
    const cells = [];
    let buffer = '';
    let escaped = false;
    let codeTicks = 0;
    for (const char of body) {
      if (escaped) {
        buffer += char;
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        buffer += char;
        continue;
      }
      if (char === '`') {
        if (codeTicks === 0) codeTicks = 1;
        else codeTicks = 0;
        buffer += char;
        continue;
      }
      if (char === '|' && codeTicks === 0) {
        cells.push(buffer.trim());
        buffer = '';
        continue;
      }
      buffer += char;
    }
    cells.push(buffer.trim());
    return cells.slice(0, LIMITS.maxTableColumns);
  }

  function isTableStart(lines, index) {
    if (index + 1 >= lines.length) return false;
    const header = splitTableRow(lines[index]);
    if (header.length < 2) return false;
    const separator = splitTableRow(lines[index + 1]);
    if (separator.length !== header.length) return false;
    return separator.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
  }

  function parseTable(lines, index) {
    const headers = splitTableRow(lines[index]);
    const separator = splitTableRow(lines[index + 1]);
    const align = separator.map((cell) => {
      const value = cell.trim();
      if (value.startsWith(':') && value.endsWith(':')) return 'center';
      if (value.endsWith(':')) return 'right';
      return 'left';
    });
    const rows = [];
    let cursor = index + 2;
    while (cursor < lines.length && lines[cursor].trim() && isTableRow(lines[cursor])) {
      rows.push(splitTableRow(lines[cursor]).slice(0, LIMITS.maxTableColumns));
      if (rows.length >= LIMITS.maxTableRows) break;
      cursor += 1;
    }
    return { block: Object.freeze({ type: 'table', headers, align, rows: Object.freeze(rows) }), next: cursor };
  }

  function isTableRow(line) {
    if (!line.includes('|')) return false;
    return splitTableRow(line).length >= 2;
  }

  function flushParagraph(paragraph, blocks) {
    if (!paragraph.length) return;
    blocks.push(Object.freeze({ type: 'paragraph', spans: scanInline(paragraph.join(' ')) }));
    paragraph.length = 0;
  }

  function flushQuote(quote, blocks) {
    if (!quote.length) return;
    blocks.push(Object.freeze({ type: 'quote', spans: scanInline(quote.join(' ')) }));
    quote.length = 0;
  }

  function flushList(list, blocks) {
    if (!list || !list.items.length) return;
    blocks.push(Object.freeze({
      type: 'list',
      ordered: list.ordered,
      start: list.start,
      items: Object.freeze(list.items.slice(0, LIMITS.maxListItems))
    }));
    list.items.length = 0;
  }

  function parseMarkdown(value) {
    const lines = normalizeInput(value).split('\n');
    const blocks = [];
    const paragraph = [];
    const quote = [];
    let list = null;

    const flushAll = () => {
      flushParagraph(paragraph, blocks);
      flushQuote(quote, blocks);
      flushList(list, blocks);
      list = null;
    };

    for (let index = 0; index < lines.length && blocks.length < LIMITS.maxBlocks; index += 1) {
      const line = lines[index];
      const fence = FENCE_PATTERN.exec(line);
      if (fence) {
        flushAll();
        const marker = fence[1][0];
        const body = [];
        const language = normalizeLanguage(fence[2]);
        let closed = false;
        index += 1;
        for (; index < lines.length && body.length < LIMITS.maxCodeLines; index += 1) {
          const closing = FENCE_PATTERN.exec(lines[index]);
          if (closing && closing[1][0] === marker && !closing[2]) {
            closed = true;
            break;
          }
          body.push(lines[index]);
        }
        blocks.push(Object.freeze({ type: 'code', language, text: body.join('\n'), closed }));
        continue;
      }

      if (!line.trim()) {
        flushAll();
        continue;
      }

      if (isTableStart(lines, index)) {
        flushAll();
        const table = parseTable(lines, index);
        blocks.push(table.block);
        index = table.next - 1;
        continue;
      }

      const heading = HEADING_PATTERN.exec(line);
      if (heading) {
        flushAll();
        blocks.push(Object.freeze({
          type: 'heading',
          level: Math.min(heading[1].length, 3),
          spans: scanInline(heading[2].slice(0, LIMITS.maxHeadingText))
        }));
        continue;
      }

      if (RULE_PATTERN.test(line)) {
        flushAll();
        blocks.push(Object.freeze({ type: 'rule' }));
        continue;
      }

      const quoted = QUOTE_PATTERN.exec(line);
      if (quoted) {
        flushParagraph(paragraph, blocks);
        flushList(list, blocks);
        list = null;
        quote.push(quoted[1]);
        continue;
      }
      flushQuote(quote, blocks);

      const bullet = BULLET_PATTERN.exec(line);
      const ordered = bullet ? null : ORDERED_PATTERN.exec(line);
      if (bullet || ordered) {
        flushParagraph(paragraph, blocks);
        const orderedMode = Boolean(ordered);
        if (list && list.ordered !== orderedMode) {
          flushList(list, blocks);
          list = null;
        }
        if (!list) list = { ordered: orderedMode, start: orderedMode ? Number(ordered[1]) : 1, items: [] };
        const text = bullet ? bullet[1] : ordered[2];
        const task = /^(?:\[x\]|\[X\]|\[ \])\s+/.exec(text);
        if (task) {
          const checked = /^\[[xX]\]\s+/.test(text);
          list.items.push(Object.freeze({ task: true, checked, spans: scanInline(text.slice(3).trim()) }));
        } else {
          list.items.push(Object.freeze({ task: false, checked: false, spans: scanInline(text) }));
        }
        continue;
      }
      flushList(list, blocks);
      list = null;
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
    for (const span of spans) {
      if (span.type === 'link') {
        const link = createElement(doc, 'a', span.text, 'md-link');
        link.setAttribute('href', span.href);
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer nofollow');
        parent.append(link);
      } else if (span.type === 'code') {
        parent.append(createElement(doc, 'code', span.text, 'md-inline-code'));
      } else if (span.type === 'strong') {
        parent.append(createElement(doc, 'strong', span.text));
      } else if (span.type === 'emphasis') {
        parent.append(createElement(doc, 'em', span.text));
      } else if (span.type === 'strike') {
        parent.append(createElement(doc, 'del', span.text));
      } else {
        parent.append(createElement(doc, 'span', span.text));
      }
    }
  }

  function codeButton(doc, labels) {
    const button = createElement(doc, 'button', labels.copy, 'md-code-copy');
    button.type = 'button';
    button.setAttribute('aria-label', labels.copyAria);
    return button;
  }

  function renderCode(doc, block, labels) {
    const wrapper = createElement(doc, 'div', undefined, 'md-code');
    const header = createElement(doc, 'div', undefined, 'md-code-head');
    const language = createElement(doc, 'span', block.language || labels.code, 'md-code-lang');
    const button = codeButton(doc, labels);
    header.append(language, button);
    const pre = doc.createElement('pre');
    const code = createElement(doc, 'code', block.text, block.language ? `language-${block.language}` : '');
    pre.append(code);
    wrapper.append(header, pre);
    return wrapper;
  }

  function renderTable(doc, block) {
    const wrapper = createElement(doc, 'div', undefined, 'md-table-wrap');
    const table = doc.createElement('table');
    table.className = 'md-table';
    const thead = doc.createElement('thead');
    const headRow = doc.createElement('tr');
    block.headers.forEach((value, index) => {
      const cell = doc.createElement('th');
      cell.textContent = '';
      appendInline(doc, cell, scanInline(value));
      if (block.align[index]) cell.style.textAlign = block.align[index];
      headRow.append(cell);
    });
    thead.append(headRow);
    const tbody = doc.createElement('tbody');
    block.rows.forEach((row) => {
      const tr = doc.createElement('tr');
      for (let index = 0; index < block.headers.length; index += 1) {
        const cell = doc.createElement('td');
        appendInline(doc, cell, scanInline(row[index] || ''));
        if (block.align[index]) cell.style.textAlign = block.align[index];
        tr.append(cell);
      }
      tbody.append(tr);
    });
    table.append(thead, tbody);
    wrapper.append(table);
    return wrapper;
  }

  function renderList(doc, block) {
    const list = doc.createElement(block.ordered ? 'ol' : 'ul');
    list.className = `md-list${block.items.some((item) => item.task) ? ' md-task-list' : ''}`;
    if (block.ordered && Number.isInteger(block.start) && block.start > 1) list.start = block.start;
    for (const item of block.items) {
      const li = doc.createElement('li');
      if (item.task) {
        li.classList.add('md-task-item');
        const marker = createElement(doc, 'span', item.checked ? '✓' : '○', 'md-task-marker');
        marker.setAttribute('aria-hidden', 'true');
        li.append(marker);
      }
      appendInline(doc, li, item.spans);
      list.append(li);
    }
    return list;
  }

  function renderBlock(doc, block, labels) {
    if (block.type === 'code') return renderCode(doc, block, labels);
    if (block.type === 'rule') return doc.createElement('hr');
    if (block.type === 'table') return renderTable(doc, block);
    if (block.type === 'list') return renderList(doc, block);

    const tag = block.type === 'heading'
      ? `h${block.level + 2}`
      : block.type === 'quote' ? 'blockquote' : 'p';
    const node = doc.createElement(tag);
    node.className = block.type === 'heading' ? 'md-heading' : block.type === 'quote' ? 'md-quote' : 'md-paragraph';
    appendInline(doc, node, block.spans);
    return node;
  }

  const DEFAULT_LABELS = Object.freeze({
    code: 'kod',
    copy: 'Kopyala',
    copied: 'Kopyalandı',
    copyAria: 'Kod bloğunu kopyala'
  });

  function renderMarkdown(container, value, options = {}) {
    if (!container || typeof container.replaceChildren !== 'function') return container;
    const doc = options.document || container.ownerDocument || globalThis.document;
    if (!doc?.createElement) return container;
    const labels = { ...DEFAULT_LABELS, ...(options.labels || {}) };
    const blocks = parseMarkdown(value);
    const nodes = blocks.length
      ? blocks.map((block) => renderBlock(doc, block, labels))
      : [createElement(doc, 'p', options.placeholder || '…', 'md-paragraph')];
    container.replaceChildren(...nodes);
    if (container.dataset) container.dataset.markdownRendered = 'true';
    return container;
  }

  function rawText(container) {
    return container?.dataset?.markdownRaw ?? container?.textContent ?? '';
  }

  function copyCode(button) {
    const code = button?.closest?.('.md-code')?.querySelector?.('pre')?.textContent ?? '';
    if (!code) return Promise.reject(new Error('EMPTY_CODE'));
    const clipboard = globalThis.navigator?.clipboard;
    if (!clipboard?.writeText) return Promise.reject(new Error('CLIPBOARD_UNAVAILABLE'));
    return clipboard.writeText(code).then(() => {
      const original = button.textContent;
      button.textContent = DEFAULT_LABELS.copied;
      button.setAttribute('aria-label', DEFAULT_LABELS.copied);
      globalThis.setTimeout(() => {
        if (button.isConnected) {
          button.textContent = original || DEFAULT_LABELS.copy;
          button.setAttribute('aria-label', DEFAULT_LABELS.copyAria);
        }
      }, 1400);
    });
  }

  function enhanceAssistant(container) {
    if (!container?.closest?.('.message.assistant')) return false;
    const raw = container.dataset?.markdownRaw;
    const source = typeof raw === 'string' ? raw : container.textContent || '';
    if (!source) return false;
    if (container.dataset) {
      container.dataset.markdownRaw = source;
      container.dataset.markdownRendered = 'false';
    }
    renderMarkdown(container, source);
    return true;
  }

  function findAssistantContent(root) {
    if (!root?.querySelectorAll) return [];
    const matches = [];
    if (root.matches?.('.message.assistant .content')) matches.push(root);
    matches.push(...root.querySelectorAll('.message.assistant .content'));
    return matches;
  }

  function install(rootDocument = globalThis.document) {
    if (!rootDocument?.querySelector) return { disconnect() {} };
    const messages = rootDocument.querySelector('#messages');
    if (!messages || messages.dataset.markdownObserverInstalled === 'true') return { disconnect() {} };
    messages.dataset.markdownObserverInstalled = 'true';

    let scheduled = false;
    let observer;
    const scan = () => {
      scheduled = false;
      for (const content of findAssistantContent(messages)) {
        const source = content.textContent || '';
        const previous = content.dataset.markdownSource;
        if (source && previous !== source && !content.dataset.markdownWriting) {
          content.dataset.markdownSource = source;
          content.dataset.markdownRaw = source;
          content.dataset.markdownWriting = 'true';
          renderMarkdown(content, source);
          content.dataset.markdownWriting = 'false';
        }
      }
    };

    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      globalThis.queueMicrotask?.(scan) || globalThis.setTimeout(scan, 0);
    };

    observer = new MutationObserver(() => schedule());
    observer.observe(messages, { subtree: true, childList: true, characterData: true });
    messages.addEventListener('click', (event) => {
      const button = event.target?.closest?.('.md-code-copy');
      if (!button || !messages.contains(button)) return;
      copyCode(button).catch(() => {
        const toast = rootDocument.querySelector('#toast');
        if (toast) {
          toast.textContent = 'Kod kopyalanamadı.';
          toast.classList.remove('hidden');
        }
      });
    });
    scan();

    return Object.freeze({ disconnect() { observer.disconnect(); } });
  }

  function sourceContainsUnsafeMarkup(source) {
    if (typeof source !== 'string') return false;
    return /innerHTML|outerHTML|insertAdjacentHTML|document\.write\s*\(/i.test(source);
  }

  return Object.freeze({
    LIMITS,
    SAFE_PROTOCOLS,
    DEFAULT_LABELS,
    parseMarkdown,
    scanInline,
    renderMarkdown,
    safeLinkHref,
    normalizeLanguage,
    rawText,
    copyCode,
    enhanceAssistant,
    install,
    sourceContainsUnsafeMarkup
  });
});
