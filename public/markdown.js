(function exposeHafizeMarkdown(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeMarkdown = api;
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeMarkdown() {
  'use strict';

  // Assistant output is not trusted input: it is shaped by the user's prompt,
  // by retrieved documents and by tool results. So this parser never produces an
  // HTML string and the renderer never touches innerHTML — every node is built
  // with createElement/createTextNode. Raw markup in the source stays literal
  // text, which is why `<script>alert(1)</script>` renders as characters.

  const MAX_NESTED_LENGTH = 20_000;
  const SAFE_LINK_PROTOCOL = /^(https?:|mailto:)/i;

  function isFence(line) {
    return /^\s{0,3}(```|~~~)/.test(line);
  }

  function fenceInfo(line) {
    const match = /^\s{0,3}(```|~~~)\s*([^\s`~]*)/.exec(line);
    if (!match) return null;
    return { marker: match[1][0], language: (match[2] || '').slice(0, 32) };
  }

  /**
   * Inline parsing produces a flat list of spans rather than nested nodes.
   * Code wins over every other marker, matching how fenced/backtick content is
   * meant to be read verbatim.
   */
  function parseInline(text) {
    const source = typeof text === 'string' ? text.slice(0, MAX_NESTED_LENGTH) : '';
    const spans = [];
    let buffer = '';

    const flush = () => {
      if (buffer) spans.push({ type: 'text', value: buffer });
      buffer = '';
    };

    for (let index = 0; index < source.length;) {
      const rest = source.slice(index);

      const code = /^`([^`\n]+)`/.exec(rest);
      if (code) {
        flush();
        spans.push({ type: 'code', value: code[1] });
        index += code[0].length;
        continue;
      }

      const link = /^\[([^\]\n]*)\]\(([^)\s]+)\)/.exec(rest);
      if (link) {
        const href = link[2];
        flush();
        // An unsafe protocol (javascript:, data:) degrades to plain text so the
        // label and target stay visible without becoming clickable.
        if (SAFE_LINK_PROTOCOL.test(href)) spans.push({ type: 'link', value: link[1] || href, href });
        else spans.push({ type: 'text', value: link[0] });
        index += link[0].length;
        continue;
      }

      const strong = /^(\*\*|__)(?=\S)([\s\S]*?\S)\1/.exec(rest);
      if (strong) {
        flush();
        spans.push({ type: 'strong', value: strong[2] });
        index += strong[0].length;
        continue;
      }

      const emphasis = /^(\*|_)(?=\S)([^*_\n]*\S)\1/.exec(rest);
      if (emphasis) {
        flush();
        spans.push({ type: 'em', value: emphasis[2] });
        index += emphasis[0].length;
        continue;
      }

      buffer += source[index];
      index += 1;
    }

    flush();
    return spans.length ? spans : [{ type: 'text', value: '' }];
  }

  function listItemInfo(line) {
    const unordered = /^\s{0,3}[-*+]\s+(.*)$/.exec(line);
    if (unordered) return { ordered: false, text: unordered[1] };
    const ordered = /^\s{0,3}(\d{1,9})[.)]\s+(.*)$/.exec(line);
    if (ordered) return { ordered: true, text: ordered[2], start: Number(ordered[1]) };
    return null;
  }

  /**
   * Block parsing. Returns plain data so it can be asserted in Node without a
   * DOM, and rendered by `renderMarkdown` in the browser.
   */
  function parseMarkdown(input) {
    const source = typeof input === 'string' ? input : '';
    const lines = source.replace(/\r\n?/g, '\n').split('\n');
    const blocks = [];
    let index = 0;

    while (index < lines.length) {
      const line = lines[index];

      if (!line.trim()) {
        index += 1;
        continue;
      }

      if (isFence(line)) {
        const info = fenceInfo(line);
        const body = [];
        index += 1;
        while (index < lines.length && !isFence(lines[index])) {
          body.push(lines[index]);
          index += 1;
        }
        // A missing closing fence still yields a code block: during streaming the
        // closing marker simply has not arrived yet.
        const closed = index < lines.length;
        if (closed) index += 1;
        blocks.push({ type: 'code', language: info?.language || '', value: body.join('\n'), closed });
        continue;
      }

      const heading = /^\s{0,3}(#{1,6})\s+(.*)$/.exec(line);
      if (heading) {
        blocks.push({ type: 'heading', level: heading[1].length, spans: parseInline(heading[2].trim()) });
        index += 1;
        continue;
      }

      if (/^\s{0,3}([-*_])\s*(\1\s*){2,}$/.test(line)) {
        blocks.push({ type: 'rule' });
        index += 1;
        continue;
      }

      const quote = /^\s{0,3}>\s?(.*)$/.exec(line);
      if (quote) {
        const body = [quote[1]];
        index += 1;
        while (index < lines.length && /^\s{0,3}>\s?/.test(lines[index])) {
          body.push(lines[index].replace(/^\s{0,3}>\s?/, ''));
          index += 1;
        }
        blocks.push({ type: 'quote', blocks: parseMarkdown(body.join('\n')) });
        continue;
      }

      const item = listItemInfo(line);
      if (item) {
        const ordered = item.ordered;
        const items = [];
        const start = ordered ? item.start : 1;
        while (index < lines.length) {
          const current = listItemInfo(lines[index]);
          if (!current || current.ordered !== ordered) break;
          items.push(parseInline(current.text));
          index += 1;
        }
        blocks.push({ type: 'list', ordered, start, items });
        continue;
      }

      const paragraph = [line.trim()];
      index += 1;
      while (index < lines.length) {
        const next = lines[index];
        if (!next.trim() || isFence(next) || listItemInfo(next) || /^\s{0,3}(#{1,6})\s+/.test(next) || /^\s{0,3}>/.test(next)) break;
        paragraph.push(next.trim());
        index += 1;
      }
      blocks.push({ type: 'paragraph', spans: parseInline(paragraph.join(' ')) });
    }

    return blocks;
  }

  function appendSpans(documentRef, parent, spans) {
    for (const span of spans) {
      if (span.type === 'code') {
        const code = documentRef.createElement('code');
        code.textContent = span.value;
        parent.appendChild(code);
        continue;
      }
      if (span.type === 'strong' || span.type === 'em') {
        const element = documentRef.createElement(span.type === 'strong' ? 'strong' : 'em');
        appendSpans(documentRef, element, parseInline(span.value));
        parent.appendChild(element);
        continue;
      }
      if (span.type === 'link') {
        const anchor = documentRef.createElement('a');
        anchor.textContent = span.value;
        anchor.href = span.href;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer nofollow';
        parent.appendChild(anchor);
        continue;
      }
      parent.appendChild(documentRef.createTextNode(span.value));
    }
  }

  function buildCodeBlock(documentRef, block) {
    const figure = documentRef.createElement('figure');
    figure.className = 'code-block';

    const head = documentRef.createElement('figcaption');
    const label = documentRef.createElement('span');
    label.textContent = block.language || 'kod';
    head.appendChild(label);

    const copy = documentRef.createElement('button');
    copy.type = 'button';
    copy.className = 'code-copy';
    copy.textContent = 'Kopyala';
    copy.dataset.code = block.value;
    head.appendChild(copy);
    figure.appendChild(head);

    const pre = documentRef.createElement('pre');
    const code = documentRef.createElement('code');
    if (block.language) code.className = `language-${block.language}`;
    code.textContent = block.value;
    pre.appendChild(code);
    figure.appendChild(pre);
    return figure;
  }

  function appendBlocks(documentRef, parent, blocks) {
    for (const block of blocks) {
      if (block.type === 'code') {
        parent.appendChild(buildCodeBlock(documentRef, block));
        continue;
      }
      if (block.type === 'heading') {
        const heading = documentRef.createElement(`h${Math.min(Math.max(block.level, 1), 6)}`);
        appendSpans(documentRef, heading, block.spans);
        parent.appendChild(heading);
        continue;
      }
      if (block.type === 'rule') {
        parent.appendChild(documentRef.createElement('hr'));
        continue;
      }
      if (block.type === 'quote') {
        const quote = documentRef.createElement('blockquote');
        appendBlocks(documentRef, quote, block.blocks);
        parent.appendChild(quote);
        continue;
      }
      if (block.type === 'list') {
        const list = documentRef.createElement(block.ordered ? 'ol' : 'ul');
        if (block.ordered && block.start !== 1) list.start = block.start;
        for (const spans of block.items) {
          const item = documentRef.createElement('li');
          appendSpans(documentRef, item, spans);
          list.appendChild(item);
        }
        parent.appendChild(list);
        continue;
      }
      const paragraph = documentRef.createElement('p');
      appendSpans(documentRef, paragraph, block.spans);
      parent.appendChild(paragraph);
    }
  }

  /**
   * Replaces `target`'s children with the rendered markdown. Safe to call on
   * every streaming tick: the node is rebuilt from scratch each time.
   */
  function renderMarkdown(documentRef, target, source) {
    if (!documentRef || !target) return target;
    target.replaceChildren();
    const text = typeof source === 'string' ? source : '';
    if (!text.trim()) {
      target.appendChild(documentRef.createTextNode('…'));
      return target;
    }
    appendBlocks(documentRef, target, parseMarkdown(text));
    return target;
  }

  return { parseMarkdown, parseInline, renderMarkdown };
});
