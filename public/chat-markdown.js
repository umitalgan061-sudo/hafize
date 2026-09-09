(function exposeHafizeChatMarkdown(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) module.exports = api;
  else root.HafizeChatMarkdown = api;
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeChatMarkdown() {
  'use strict';

  // Model output is untrusted text. Nothing here ever builds markup from a
  // string: the parser produces a plain node tree and the renderer turns that
  // tree into elements with createElement/textContent only. No HTML-string
  // assignment exists here, so a message can never inject markup or script —
  // scripts/test-chat-markdown.mjs asserts that this file stays free of one.

  const MAX_INPUT_LENGTH = 64_000;
  const MAX_BLOCKS = 400;
  const MAX_HEADING_LEVEL = 3;
  const MAX_LIST_ITEMS = 200;
  const MAX_INLINE_LENGTH = 4_000;
  const MAX_LANGUAGE_LENGTH = 24;
  const SAFE_LINK_PROTOCOLS = Object.freeze(['http:', 'https:', 'mailto:']);
  const LANGUAGE_PATTERN = /^[a-z0-9][a-z0-9+#._-]*$/i;
  const FENCE_PATTERN = /^\s{0,3}(`{3,}|~{3,})\s*([^`\s]*)\s*$/;
  const HEADING_PATTERN = /^\s{0,3}(#{1,6})\s+(.*)$/;
  const BULLET_PATTERN = /^\s{0,3}[-*+]\s+(.+)$/;
  const ORDERED_PATTERN = /^\s{0,3}(\d{1,3})[.)]\s+(.+)$/;
  const QUOTE_PATTERN = /^\s{0,3}>\s?(.*)$/;
  const RULE_PATTERN = /^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/;
  // Inline order matters: code spans win over emphasis so `**` inside a code
  // span stays literal, and links are matched before bare emphasis runs.
  const INLINE_PATTERN = new RegExp([
    '(`+)([\\s\\S]*?)\\1',
    '\\[([^\\]\\n]{1,200})\\]\\(([^()\\s]{1,500})\\)',
    '(\\*\\*|__)(?=\\S)([\\s\\S]*?\\S)\\5',
    '(\\*|_)(?=\\S)([\\s\\S]*?\\S)\\7'
  ].join('|'), 'g');

  function normalizeInput(value) {
    if (typeof value !== 'string') return '';
    return value.slice(0, MAX_INPUT_LENGTH).replace(/\r\n?/g, '\n').replace(/\0/g, '');
  }

  function normalizeLanguage(value) {
    const language = typeof value === 'string' ? value.trim().slice(0, MAX_LANGUAGE_LENGTH) : '';
    return LANGUAGE_PATTERN.test(language) ? language.toLowerCase() : '';
  }

  function safeLinkHref(value) {
    const href = typeof value === 'string' ? value.trim() : '';
    if (!href || href.length > 500) return '';
    try {
      // Only an absolute URL with an allowlisted protocol becomes a link.
      // `javascript:` and `data:` fail the allowlist and a relative target fails
      // the parse, so both fall back to plain text instead of a clickable node.
      const url = new URL(href);
      return SAFE_LINK_PROTOCOLS.includes(url.protocol) ? url.href : '';
    } catch {
      return '';
    }
  }

  const textSpan = (value) => Object.freeze({ type: 'text', text: value });

  function parseInline(line) {
    const source = typeof line === 'string' ? line : '';
    // The inline scan is quadratic against a long run of unmatched markers, and
    // a streamed answer re-renders on every chunk — so an over-long line is kept
    // as plain text rather than locking the tab for seconds per chunk.
    if (source.length > MAX_INLINE_LENGTH) return Object.freeze([textSpan(source)]);
    const spans = [];
    let index = 0;
    INLINE_PATTERN.lastIndex = 0;
    for (let match = INLINE_PATTERN.exec(source); match; match = INLINE_PATTERN.exec(source)) {
      if (match.index > index) spans.push(textSpan(source.slice(index, match.index)));
      const [raw, , codeText, linkText, linkHref, , strongText, , emphasisText] = match;
      if (codeText !== undefined) {
        spans.push(Object.freeze({ type: 'code', text: codeText.trim() }));
      } else if (linkText !== undefined) {
        const href = safeLinkHref(linkHref);
        if (href) spans.push(Object.freeze({ type: 'link', text: linkText, href }));
        else spans.push(textSpan(raw));
      } else if (strongText !== undefined) {
        spans.push(Object.freeze({ type: 'strong', text: strongText }));
      } else {
        spans.push(Object.freeze({ type: 'emphasis', text: emphasisText }));
      }
      index = match.index + raw.length;
    }
    if (index < source.length) spans.push(textSpan(source.slice(index)));
    return Object.freeze(spans.filter((span) => span.text !== ''));
  }

  function parseMarkdown(value) {
    const lines = normalizeInput(value).split('\n');
    const blocks = [];
    let paragraph = [];
    let quote = [];
    let list = null;

    function flushParagraph() {
      if (paragraph.length) blocks.push(Object.freeze({ type: 'paragraph', spans: parseInline(paragraph.join(' ')) }));
      paragraph = [];
    }
    function flushQuote() {
      if (quote.length) blocks.push(Object.freeze({ type: 'quote', spans: parseInline(quote.join(' ')) }));
      quote = [];
    }
    function flushList() {
      if (list?.items.length) blocks.push(Object.freeze({ type: 'list', ordered: list.ordered, items: Object.freeze(list.items) }));
      list = null;
    }
    function flushAll() { flushParagraph(); flushQuote(); flushList(); }

    for (let cursor = 0; cursor < lines.length && blocks.length < MAX_BLOCKS; cursor += 1) {
      const line = lines[cursor];
      const fence = FENCE_PATTERN.exec(line);
      if (fence) {
        flushAll();
        const marker = fence[1][0];
        const body = [];
        let closed = false;
        cursor += 1;
        for (; cursor < lines.length; cursor += 1) {
          const closing = FENCE_PATTERN.exec(lines[cursor]);
          if (closing && closing[1][0] === marker && !closing[2]) {
            closed = true;
            break;
          }
          body.push(lines[cursor]);
        }
        // An unterminated fence is the normal mid-stream state: render what has
        // arrived as a code block instead of leaking backticks into the text.
        blocks.push(Object.freeze({
          type: 'code',
          language: normalizeLanguage(fence[2]),
          text: body.join('\n'),
          closed
        }));
        continue;
      }

      if (!line.trim()) {
        flushAll();
        continue;
      }

      const heading = HEADING_PATTERN.exec(line);
      if (heading) {
        flushAll();
        blocks.push(Object.freeze({
          type: 'heading',
          level: Math.min(heading[1].length, MAX_HEADING_LEVEL),
          spans: parseInline(heading[2].replace(/\s+#+\s*$/, ''))
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
        flushParagraph();
        flushList();
        quote.push(quoted[1]);
        continue;
      }
      flushQuote();

      const bullet = BULLET_PATTERN.exec(line);
      const ordered = bullet ? null : ORDERED_PATTERN.exec(line);
      if (bullet || ordered) {
        flushParagraph();
        const isOrdered = Boolean(ordered);
        if (list && list.ordered !== isOrdered) flushList();
        if (!list) list = { ordered: isOrdered, items: [] };
        if (list.items.length < MAX_LIST_ITEMS) list.items.push(parseInline(bullet ? bullet[1] : ordered[2]));
        continue;
      }
      flushList();

      // A wrapped paragraph keeps flowing until a blank line, so soft breaks
      // inside one paragraph join with a space rather than starting a block.
      paragraph.push(line.trim());
    }

    flushAll();
    return Object.freeze(blocks.slice(0, MAX_BLOCKS));
  }

  function element(doc, tag, text, className = '') {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    node.textContent = text;
    return node;
  }

  function appendSpans(doc, parent, spans) {
    for (const span of spans) {
      if (span.type === 'link') {
        const link = element(doc, 'a', span.text);
        link.setAttribute('href', span.href);
        link.setAttribute('rel', 'noopener noreferrer nofollow');
        link.setAttribute('target', '_blank');
        parent.append(link);
        continue;
      }
      if (span.type === 'code') parent.append(element(doc, 'code', span.text, 'md-inline-code'));
      else if (span.type === 'strong') parent.append(element(doc, 'strong', span.text));
      else if (span.type === 'emphasis') parent.append(element(doc, 'em', span.text));
      else parent.append(element(doc, 'span', span.text));
    }
  }

  function buildCodeBlock(doc, block, labels) {
    const head = doc.createElement('div');
    head.className = 'md-code-head';
    const copy = element(doc, 'button', labels.copy, 'md-code-copy mini-btn');
    copy.type = 'button';
    copy.setAttribute('aria-label', labels.copyAria);
    head.append(element(doc, 'span', block.language || labels.code, 'md-code-lang'), copy);

    const pre = doc.createElement('pre');
    pre.append(element(doc, 'code', block.text, block.language ? `language-${block.language}` : ''));
    const wrap = doc.createElement('div');
    wrap.className = 'md-code';
    wrap.append(head, pre);
    return wrap;
  }

  function renderBlock(doc, block, labels) {
    if (block.type === 'code') return buildCodeBlock(doc, block, labels);
    if (block.type === 'rule') return doc.createElement('hr');
    if (block.type === 'list') {
      const list = doc.createElement(block.ordered ? 'ol' : 'ul');
      list.className = 'md-list';
      for (const item of block.items) {
        const entry = doc.createElement('li');
        appendSpans(doc, entry, item);
        list.append(entry);
      }
      return list;
    }
    const heading = block.type === 'heading';
    const quote = block.type === 'quote';
    // Headings start at h3: the page already owns h1/h2, so a model heading must
    // not outrank the app's own document outline.
    const node = doc.createElement(heading ? `h${block.level + 2}` : quote ? 'blockquote' : 'p');
    if (heading || quote) node.className = heading ? 'md-heading' : 'md-quote';
    appendSpans(doc, node, block.spans);
    return node;
  }

  const DEFAULT_LABELS = Object.freeze({ code: 'kod', copy: 'Kopyala', copyAria: 'Kod bloğunu kopyala' });

  function renderMarkdown(container, value, { document: doc, labels = DEFAULT_LABELS, placeholder = '…' } = {}) {
    if (!container || !doc || typeof doc.createElement !== 'function') return container;
    const blocks = parseMarkdown(value);
    const resolved = { ...DEFAULT_LABELS, ...labels };
    const nodes = blocks.length
      ? blocks.map((block) => renderBlock(doc, block, resolved))
      : [element(doc, 'p', placeholder)];
    container.replaceChildren(...nodes);
    return container;
  }

  return Object.freeze({
    CHAT_MARKDOWN_LIMITS: Object.freeze({
      maxInputLength: MAX_INPUT_LENGTH,
      maxBlocks: MAX_BLOCKS,
      maxListItems: MAX_LIST_ITEMS,
      maxInlineLength: MAX_INLINE_LENGTH,
      safeLinkProtocols: SAFE_LINK_PROTOCOLS
    }),
    DEFAULT_LABELS,
    parseInline,
    parseMarkdown,
    renderMarkdown,
    safeLinkHref
  });
});
