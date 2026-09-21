// TypeScript migration wave 2026-09.
// Runtime behavior remains compatible with the previous browser-global surface.
// The module is bundled by Vite/Rolldown and loaded as a generated entrypoint.
// @ts-nocheck
(function exposeHafizeMarkdown(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) module.exports = api;
  else root.HafizeMarkdown = api;
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeMarkdown() {
  'use strict';

  // Model output is untrusted text. This renderer never hands a string to the
  // HTML parser: every node is built with `createElement` / `createTextNode`,
  // so raw `<script>` or `<img onerror=…>` inside an answer stays literal text.
  // Only `http:`, `https:` and `mailto:` ever reach an `href`.
  const SAFE_SCHEMES = Object.freeze(['http:', 'https:', 'mailto:']);

  // Bounds keep a hostile or runaway answer from turning into an unbounded
  // parse. Every limit degrades to plain text instead of throwing.
  const LIMITS = Object.freeze({
    MAX_SOURCE_LENGTH: 120_000,
    MAX_LINES: 4_000,
    MAX_BLOCKS: 800,
    MAX_BLOCK_DEPTH: 6,
    MAX_INLINE_DEPTH: 8,
    MAX_INLINE_NODES: 600,
    MAX_LIST_ITEMS: 300,
    MAX_TABLE_ROWS: 120,
    MAX_TABLE_COLUMNS: 16,
    MAX_CODE_LANGUAGE_LENGTH: 24,
    MAX_URL_LENGTH: 2_048,
    MAX_TITLE_LENGTH: 200
  });

  const HEADING_PATTERN = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/;
  const FENCE_OPEN_PATTERN = /^( {0,3})(`{3,}|~{3,})[ \t]*([^`]*)$/;
  const DIVIDER_PATTERN = /^ {0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/;
  const QUOTE_PATTERN = /^ {0,3}>[ \t]?/;
  const LIST_ITEM_PATTERN = /^( {0,3})([-+*]|\d{1,9}[.)])([ \t]+)(.*)$/;
  const EMPTY_LIST_ITEM_PATTERN = /^( {0,3})([-+*]|\d{1,9}[.)])[ \t]*$/;
  const TABLE_DELIMITER_CELL_PATTERN = /^:?-{1,}:?$/;
  const CODE_LANGUAGE_PATTERN = /^[A-Za-z0-9+#._-]{1,24}$/;
  const ESCAPABLE_PATTERN = /[\\`*_{}[\]()#+\-.!|~<>"']/;
  const WORD_CHARACTER_PATTERN = /[\p{L}\p{N}]/u;
  const BARE_URL_PATTERN = /^https?:\/\/[^\s<>`]+/i;
  const AUTOLINK_PATTERN = /^<((?:https?|mailto):[^\s<>]{1,2048})>/i;

  function normalizeSource(value) {
    if (typeof value !== 'string' || !value) return '';
    return value
      .replace(/\r\n?/g, '\n')
      // Lone surrogates and NULs would survive into the DOM as invisible junk.
      .replace(/\u0000/g, '\uFFFD')
      .replace(/\t/g, '    ');
  }

  /** Returns the URL when it is safe to put in an `href`, otherwise an empty string. */
  function safeUrl(value) {
    const raw = String(value ?? '').trim();
    if (!raw || raw.length > LIMITS.MAX_URL_LENGTH) return '';
    // Control characters (including the tab/newline tricks used to smuggle
    // `java\tscript:`) and spaces disqualify the whole destination.
    if (/[\u0000-\u0020\u007f]/.test(raw)) return '';
    const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(raw);
    // Relative destinations are dropped as well: a model has no business
    // linking into the application's own routes.
    if (!scheme) return '';
    return SAFE_SCHEMES.includes(`${scheme[1].toLowerCase()}:`) ? raw : '';
  }

  function runLength(text, index, character) {
    let length = 0;
    while (index + length < text.length && text[index + length] === character) length += 1;
    return length;
  }

  function leadingSpaces(line) {
    let count = 0;
    while (count < line.length && line[count] === ' ') count += 1;
    return count;
  }

  function createState() {
    return { blocks: 0, truncated: false };
  }

  function countBlock(state) {
    state.blocks += 1;
    if (state.blocks > LIMITS.MAX_BLOCKS) {
      state.truncated = true;
      return false;
    }
    return true;
  }

  /* ------------------------------------------------------------------ *
   * Inline scanner
   * ------------------------------------------------------------------ */

  function findCodeSpanClose(text, from, length) {
    let index = from;
    while (index < text.length) {
      if (text[index] !== '`') {
        index += 1;
        continue;
      }
      const run = runLength(text, index, '`');
      if (run === length) return index;
      index += run;
    }
    return -1;
  }

  function normalizeCodeSpan(value) {
    const collapsed = value.replace(/\n/g, ' ');
    if (collapsed.length > 2 && collapsed.startsWith(' ') && collapsed.endsWith(' ') && collapsed.trim()) {
      return collapsed.slice(1, -1);
    }
    return collapsed;
  }

  function findEmphasisClose(text, from, character, count) {
    let index = from;
    while (index < text.length) {
      const current = text[index];
      if (current === '\\') {
        index += 2;
        continue;
      }
      if (current === '`') {
        const run = runLength(text, index, '`');
        const close = findCodeSpanClose(text, index + run, run);
        index = close < 0 ? index + run : close + run;
        continue;
      }
      if (current !== character) {
        index += 1;
        continue;
      }
      const run = runLength(text, index, character);
      const previous = text[index - 1];
      const following = text[index + run];
      const closes = run >= count
        && previous !== undefined
        && !/\s/.test(previous)
        // `snake_case_word` must not be split in the middle of a word.
        && (character !== '_' || !following || !WORD_CHARACTER_PATTERN.test(following));
      if (closes) return index;
      index += run;
    }
    return -1;
  }

  function findLinkLabelEnd(text, start) {
    let depth = 0;
    let index = start;
    while (index < text.length) {
      const current = text[index];
      if (current === '\\') {
        index += 2;
        continue;
      }
      if (current === '`') {
        const run = runLength(text, index, '`');
        const close = findCodeSpanClose(text, index + run, run);
        index = close < 0 ? index + run : close + run;
        continue;
      }
      if (current === '[') depth += 1;
      else if (current === ']') {
        depth -= 1;
        if (depth === 0) return index;
      }
      index += 1;
    }
    return -1;
  }

  /** Parses `(destination "title")` starting at the opening parenthesis. */
  function parseLinkTarget(text, start) {
    if (text[start] !== '(') return null;
    let index = start + 1;
    while (index < text.length && /[ \t\n]/.test(text[index])) index += 1;

    let destination = '';
    if (text[index] === '<') {
      const close = text.indexOf('>', index + 1);
      if (close < 0) return null;
      destination = text.slice(index + 1, close);
      index = close + 1;
    } else {
      let depth = 0;
      const begin = index;
      while (index < text.length) {
        const current = text[index];
        if (current === '\\') {
          index += 2;
          continue;
        }
        if (/[ \t\n]/.test(current)) break;
        if (current === '(') depth += 1;
        else if (current === ')') {
          if (depth === 0) break;
          depth -= 1;
        }
        index += 1;
      }
      destination = text.slice(begin, index).replace(/\\([\\`*_{}[\]()#+\-.!|~<>"'])/g, '$1');
    }

    while (index < text.length && /[ \t\n]/.test(text[index])) index += 1;

    let title = '';
    const quote = text[index];
    if (quote === '"' || quote === "'") {
      const close = text.indexOf(quote, index + 1);
      if (close < 0) return null;
      title = text.slice(index + 1, close).slice(0, LIMITS.MAX_TITLE_LENGTH);
      index = close + 1;
      while (index < text.length && /[ \t\n]/.test(text[index])) index += 1;
    }

    if (text[index] !== ')') return null;
    return { destination, title, end: index + 1 };
  }

  function trimBareUrl(value) {
    let url = value;
    while (url.length > 1) {
      const last = url[url.length - 1];
      if (/[.,;:!?'"]/.test(last)) {
        url = url.slice(0, -1);
        continue;
      }
      if (last === ')' && (url.match(/\(/g)?.length ?? 0) < (url.match(/\)/g)?.length ?? 0)) {
        url = url.slice(0, -1);
        continue;
      }
      if (last === ']' || last === '}' || last === '>') {
        url = url.slice(0, -1);
        continue;
      }
      break;
    }
    return url;
  }

  function parseInline(text, state = createState(), depth = 0) {
    const source = typeof text === 'string' ? text : '';
    const nodes = [];
    let buffer = '';

    const flush = () => {
      if (!buffer) return;
      nodes.push({ type: 'text', value: buffer });
      buffer = '';
    };
    const push = (node) => {
      flush();
      nodes.push(node);
    };
    const nested = (value) => (depth >= LIMITS.MAX_INLINE_DEPTH
      ? [{ type: 'text', value }]
      : parseInline(value, state, depth + 1));

    let index = 0;
    while (index < source.length) {
      if (nodes.length >= LIMITS.MAX_INLINE_NODES) {
        state.truncated = true;
        buffer += source.slice(index);
        break;
      }

      const character = source[index];

      if (character === '\\' && ESCAPABLE_PATTERN.test(source[index + 1] ?? '')) {
        buffer += source[index + 1];
        index += 2;
        continue;
      }

      if (character === '\n') {
        // A newline inside a chat answer is a line the model meant to keep.
        buffer = buffer.replace(/[ \t]+$/, '');
        push({ type: 'break' });
        index += 1;
        continue;
      }

      if (character === '`') {
        const run = runLength(source, index, '`');
        const close = findCodeSpanClose(source, index + run, run);
        if (close > 0) {
          push({ type: 'code', value: normalizeCodeSpan(source.slice(index + run, close)) });
          index = close + run;
          continue;
        }
        buffer += source.slice(index, index + run);
        index += run;
        continue;
      }

      if (character === '<') {
        const autolink = AUTOLINK_PATTERN.exec(source.slice(index));
        const href = autolink ? safeUrl(autolink[1]) : '';
        if (href) {
          push({ type: 'link', href, title: '', children: [{ type: 'text', value: autolink[1] }] });
          index += autolink[0].length;
          continue;
        }
      }

      if ((character === '[' || (character === '!' && source[index + 1] === '['))) {
        const image = character === '!';
        const labelStart = image ? index + 1 : index;
        const labelEnd = findLinkLabelEnd(source, labelStart);
        const target = labelEnd > 0 ? parseLinkTarget(source, labelEnd + 1) : null;
        const href = target ? safeUrl(target.destination) : '';
        if (href) {
          const label = source.slice(labelStart + 1, labelEnd);
          const children = label ? nested(label) : [{ type: 'text', value: href }];
          // Images are deliberately rendered as links: an answer must not be
          // able to make the browser fetch a remote asset on its own.
          push({ type: 'link', href, title: target.title, image, children });
          index = target.end;
          continue;
        }
      }

      if (character === '~' && source[index + 1] === '~' && source[index + 2] && !/[\s~]/.test(source[index + 2])) {
        const close = findEmphasisClose(source, index + 2, '~', 2);
        if (close > index + 2) {
          push({ type: 'strike', children: nested(source.slice(index + 2, close)) });
          index = close + 2;
          continue;
        }
      }

      if (character === '*' || character === '_') {
        const run = runLength(source, index, character);
        const following = source[index + run];
        const previous = source[index - 1];
        const canOpen = following !== undefined
          && !/\s/.test(following)
          && (character !== '_' || !previous || !WORD_CHARACTER_PATTERN.test(previous));
        if (canOpen) {
          const count = Math.min(run, 3);
          const close = findEmphasisClose(source, index + count, character, count);
          if (close > 0) {
            const inner = nested(source.slice(index + count, close));
            if (count >= 3) push({ type: 'strong', children: [{ type: 'em', children: inner }] });
            else if (count === 2) push({ type: 'strong', children: inner });
            else push({ type: 'em', children: inner });
            index = close + count;
            continue;
          }
        }
      }

      if ((character === 'h' || character === 'H') && (index === 0 || /[\s(<]/.test(source[index - 1]))) {
        const match = BARE_URL_PATTERN.exec(source.slice(index));
        const url = match ? trimBareUrl(match[0]) : '';
        const href = url ? safeUrl(url) : '';
        if (href) {
          push({ type: 'link', href, title: '', children: [{ type: 'text', value: url }] });
          index += url.length;
          continue;
        }
      }

      buffer += character;
      index += 1;
    }

    flush();
    return nodes;
  }

  /* ------------------------------------------------------------------ *
   * Block scanner
   * ------------------------------------------------------------------ */

  function splitTableRow(line) {
    const cells = [];
    let current = '';
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === '\\' && line[index + 1] === '|') {
        current += '|';
        index += 1;
        continue;
      }
      if (character === '|') {
        cells.push(current);
        current = '';
        continue;
      }
      current += character;
    }
    cells.push(current);
    if (cells.length > 1 && !cells[0].trim()) cells.shift();
    if (cells.length > 1 && !cells[cells.length - 1].trim()) cells.pop();
    return cells.map((cell) => cell.trim());
  }

  function tableAlignments(line) {
    const cells = splitTableRow(line);
    if (!cells.length || cells.length > LIMITS.MAX_TABLE_COLUMNS) return null;
    if (!cells.every((cell) => TABLE_DELIMITER_CELL_PATTERN.test(cell))) return null;
    return cells.map((cell) => {
      const left = cell.startsWith(':');
      const right = cell.endsWith(':');
      if (left && right) return 'center';
      if (right) return 'right';
      if (left) return 'left';
      return '';
    });
  }

  function isBlockStart(line) {
    if (!line || !line.trim()) return true;
    return HEADING_PATTERN.test(line)
      || FENCE_OPEN_PATTERN.test(line)
      || DIVIDER_PATTERN.test(line)
      || QUOTE_PATTERN.test(line)
      || LIST_ITEM_PATTERN.test(line)
      || EMPTY_LIST_ITEM_PATTERN.test(line);
  }

  function listMarkerKind(marker) {
    return /\d/.test(marker) ? `ordered:${marker.slice(-1)}` : `bullet:${marker}`;
  }

  function readFencedCode(lines, start, state) {
    const open = FENCE_OPEN_PATTERN.exec(lines[start]);
    if (!open) return null;
    const indent = open[1].length;
    const fence = open[2];
    const character = fence[0];
    const info = open[3].trim().split(/\s+/)[0] ?? '';
    const language = CODE_LANGUAGE_PATTERN.test(info) ? info.slice(0, LIMITS.MAX_CODE_LANGUAGE_LENGTH) : '';

    const body = [];
    let index = start + 1;
    let closed = false;
    while (index < lines.length) {
      const line = lines[index];
      const close = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
      if (close && close[1][0] === character && close[1].length >= fence.length) {
        closed = true;
        index += 1;
        break;
      }
      body.push(line.slice(Math.min(indent, leadingSpaces(line))));
      index += 1;
    }

    return {
      block: { type: 'code', language, text: body.join('\n'), closed },
      next: index
    };
  }

  function readQuote(lines, start) {
    const body = [];
    let index = start;
    while (index < lines.length) {
      const line = lines[index];
      if (QUOTE_PATTERN.test(line)) {
        body.push(line.replace(QUOTE_PATTERN, ''));
        index += 1;
        continue;
      }
      // Lazy continuation: a plain paragraph line right after a quote line
      // stays inside the quote, the way every chat renderer treats it.
      if (line.trim() && body.length && body[body.length - 1].trim() && !isBlockStart(line)) {
        body.push(line.trim());
        index += 1;
        continue;
      }
      break;
    }
    return { body, next: index };
  }

  function readList(lines, start, state, depth) {
    const first = LIST_ITEM_PATTERN.exec(lines[start]) ?? EMPTY_LIST_ITEM_PATTERN.exec(lines[start]);
    if (!first) return null;
    const kind = listMarkerKind(first[2]);
    const ordered = kind.startsWith('ordered');
    const start1 = ordered ? Math.max(0, Number.parseInt(first[2], 10) || 1) : 1;

    const items = [];
    let loose = false;
    let index = start;

    while (index < lines.length) {
      const match = LIST_ITEM_PATTERN.exec(lines[index]) ?? EMPTY_LIST_ITEM_PATTERN.exec(lines[index]);
      if (!match || listMarkerKind(match[2]) !== kind) break;
      if (items.length >= LIMITS.MAX_LIST_ITEMS) {
        state.truncated = true;
        break;
      }

      const markerIndent = match[1].length;
      const spacing = match[3] ? Math.min(match[3].length, 4) : 1;
      const contentIndent = markerIndent + match[2].length + spacing;
      const itemLines = [match[4] ?? ''];
      index += 1;

      let blanks = 0;
      while (index < lines.length) {
        const line = lines[index];
        if (!line.trim()) {
          blanks += 1;
          index += 1;
          continue;
        }
        if (leadingSpaces(line) >= contentIndent) {
          if (blanks) {
            itemLines.push('');
            loose = true;
            blanks = 0;
          }
          itemLines.push(line.slice(contentIndent));
          index += 1;
          continue;
        }
        if (blanks) break;
        if (isBlockStart(line)) break;
        itemLines.push(line.trim());
        index += 1;
      }

      // A blank line before the *next item of this same list* is what makes a
      // list loose; a blank line before an unrelated block just ends the list.
      if (blanks && index < lines.length) {
        const following = LIST_ITEM_PATTERN.exec(lines[index]) ?? EMPTY_LIST_ITEM_PATTERN.exec(lines[index]);
        if (following && listMarkerKind(following[2]) === kind) loose = true;
      }

      items.push({ blocks: parseBlockLines(itemLines, state, depth + 1) });
    }

    if (!items.length) return null;
    return {
      block: { type: 'list', ordered, start: ordered ? start1 : 1, tight: !loose, items },
      next: index
    };
  }

  /** Cheap lookahead used by the paragraph scanner, with no parsing side effects. */
  function isTableStart(lines, start) {
    const header = lines[start];
    const delimiter = lines[start + 1];
    if (!header || !delimiter || !header.includes('|')) return false;
    const align = tableAlignments(delimiter);
    return Boolean(align) && splitTableRow(header).length === align.length;
  }

  function readTable(lines, start, state) {
    if (!isTableStart(lines, start)) return null;
    const align = tableAlignments(lines[start + 1]);
    const headerCells = splitTableRow(lines[start]);

    const rows = [];
    let index = start + 2;
    while (index < lines.length) {
      const line = lines[index];
      if (!line.trim() || !line.includes('|')) break;
      if (rows.length >= LIMITS.MAX_TABLE_ROWS) {
        state.truncated = true;
        break;
      }
      const cells = splitTableRow(line);
      const padded = Array.from({ length: align.length }, (unused, column) => parseInline(cells[column] ?? '', state));
      rows.push(padded);
      index += 1;
    }

    return {
      block: {
        type: 'table',
        align,
        header: headerCells.map((cell) => parseInline(cell, state)),
        rows
      },
      next: index
    };
  }

  function parseBlockLines(lines, state, depth = 0) {
    const blocks = [];
    if (depth > LIMITS.MAX_BLOCK_DEPTH) {
      const text = lines.join('\n').trim();
      if (text) blocks.push({ type: 'paragraph', inline: [{ type: 'text', value: text }] });
      return blocks;
    }

    let index = 0;
    while (index < lines.length) {
      const line = lines[index];
      if (!line.trim()) {
        index += 1;
        continue;
      }
      if (!countBlock(state)) break;

      const fenced = readFencedCode(lines, index, state);
      if (fenced) {
        blocks.push(fenced.block);
        index = fenced.next;
        continue;
      }

      const heading = HEADING_PATTERN.exec(line);
      if (heading) {
        const text = (heading[2] ?? '').replace(/[ \t]+#+[ \t]*$/, '');
        blocks.push({ type: 'heading', level: heading[1].length, inline: parseInline(text, state) });
        index += 1;
        continue;
      }

      if (DIVIDER_PATTERN.test(line)) {
        blocks.push({ type: 'divider' });
        index += 1;
        continue;
      }

      if (QUOTE_PATTERN.test(line)) {
        const quote = readQuote(lines, index);
        blocks.push({ type: 'quote', blocks: parseBlockLines(quote.body, state, depth + 1) });
        index = quote.next;
        continue;
      }

      const table = readTable(lines, index, state);
      if (table) {
        blocks.push(table.block);
        index = table.next;
        continue;
      }

      const list = readList(lines, index, state, depth);
      if (list) {
        blocks.push(list.block);
        index = list.next;
        continue;
      }

      const paragraph = [line.trim()];
      index += 1;
      while (index < lines.length) {
        const next = lines[index];
        if (!next.trim() || isBlockStart(next) || isTableStart(lines, index)) break;
        paragraph.push(next.trim());
        index += 1;
      }
      blocks.push({ type: 'paragraph', inline: parseInline(paragraph.join('\n'), state) });
    }

    return blocks;
  }

  /**
   * Parses markdown into a bounded block tree.
   * Returns `{ blocks, truncated, source }`; `truncated` means a limit was hit
   * and the tail of the answer is carried as plain text instead.
   */
  function parseMarkdown(value) {
    const normalized = normalizeSource(value);
    const state = createState();
    if (!normalized.trim()) return { blocks: [], truncated: false, source: normalized };

    let working = normalized;
    if (working.length > LIMITS.MAX_SOURCE_LENGTH) {
      working = working.slice(0, LIMITS.MAX_SOURCE_LENGTH);
      state.truncated = true;
    }
    let lines = working.split('\n');
    if (lines.length > LIMITS.MAX_LINES) {
      lines = lines.slice(0, LIMITS.MAX_LINES);
      state.truncated = true;
    }

    const blocks = parseBlockLines(lines, state, 0);
    return { blocks, truncated: state.truncated, source: normalized };
  }

  /** True when the text needs more than a plain text node to read correctly. */
  function hasMarkdown(value) {
    const normalized = normalizeSource(value);
    if (!normalized.trim()) return false;
    return /(^|\n) {0,3}(#{1,6}[ \t]|[-+*][ \t]|\d{1,9}[.)][ \t]|>[ \t]?|```|~~~|\|)/.test(normalized)
      || /(\*\*|__|~~|`|\[[^\]]*\]\(|<https?:|https?:\/\/)/.test(normalized);
  }

  /* ------------------------------------------------------------------ *
   * Plain-text projection
   * ------------------------------------------------------------------ */

  function inlineToPlainText(nodes) {
    let text = '';
    for (const node of nodes ?? []) {
      if (!node || typeof node !== 'object') continue;
      if (node.type === 'text' || node.type === 'code') text += node.value;
      else if (node.type === 'break') text += '\n';
      else if (node.type === 'link') {
        const label = inlineToPlainText(node.children);
        text += label || node.href;
      } else text += inlineToPlainText(node.children);
    }
    return text;
  }

  function blocksToPlainText(blocks) {
    const parts = [];
    for (const block of blocks ?? []) {
      if (!block || typeof block !== 'object') continue;
      if (block.type === 'paragraph' || block.type === 'heading') parts.push(inlineToPlainText(block.inline));
      else if (block.type === 'code') parts.push(block.text);
      else if (block.type === 'quote') parts.push(blocksToPlainText(block.blocks));
      else if (block.type === 'list') {
        const lines = block.items.map((item, position) => {
          const body = blocksToPlainText(item.blocks).replace(/\n{2,}/g, '\n');
          return block.ordered ? `${block.start + position}. ${body}` : body;
        });
        parts.push(lines.join('\n'));
      } else if (block.type === 'table') {
        const rows = [block.header, ...block.rows]
          .map((row) => row.map((cell) => inlineToPlainText(cell)).join(' · '));
        parts.push(rows.join('\n'));
      }
    }
    return parts.filter((part) => part.trim()).join('\n\n');
  }

  /**
   * The answer as readable plain text: the same words a reader sees, without
   * the markdown punctuation. Voice output and the message workspace use it so
   * a rendered answer still reads with its line breaks intact — DOM
   * `textContent` would run the blocks together.
   */
  function toPlainText(value) {
    const normalized = normalizeSource(value);
    if (!normalized.trim()) return '';
    return blocksToPlainText(parseMarkdown(normalized).blocks) || normalized;
  }

  /* ------------------------------------------------------------------ *
   * DOM rendering
   * ------------------------------------------------------------------ */

  const sourceByContainer = new WeakMap();

  function element(doc, tag, className) {
    const node = doc.createElement(tag);
    if (className) node.setAttribute('class', className);
    return node;
  }

  function renderInlineInto(doc, parent, nodes) {
    for (const node of nodes ?? []) {
      if (!node || typeof node !== 'object') continue;
      if (node.type === 'text') {
        parent.appendChild(doc.createTextNode(node.value));
        continue;
      }
      if (node.type === 'break') {
        parent.appendChild(element(doc, 'br'));
        continue;
      }
      if (node.type === 'code') {
        const code = element(doc, 'code', 'md-inline-code');
        code.textContent = node.value;
        parent.appendChild(code);
        continue;
      }
      if (node.type === 'link') {
        const href = safeUrl(node.href);
        if (!href) {
          renderInlineInto(doc, parent, node.children);
          continue;
        }
        const anchor = element(doc, 'a', node.image ? 'md-link md-link-image' : 'md-link');
        anchor.setAttribute('href', href);
        anchor.setAttribute('target', '_blank');
        anchor.setAttribute('rel', 'noopener noreferrer nofollow ugc');
        if (node.title) anchor.setAttribute('title', node.title);
        renderInlineInto(doc, anchor, node.children);
        parent.appendChild(anchor);
        continue;
      }
      const tag = node.type === 'strong' ? 'strong' : node.type === 'em' ? 'em' : node.type === 'strike' ? 's' : '';
      if (!tag) continue;
      const wrapper = element(doc, tag);
      renderInlineInto(doc, wrapper, node.children);
      parent.appendChild(wrapper);
    }
  }

  function renderCodeBlock(doc, block) {
    const figure = element(doc, 'div', 'md-code');
    if (block.language) figure.setAttribute('data-language', block.language);
    if (!block.closed) figure.setAttribute('data-streaming', 'true');

    const head = element(doc, 'div', 'md-code-head');
    const label = element(doc, 'span', 'md-code-lang');
    // The label and the button carry no text nodes on purpose: `textContent`
    // of a rendered answer has to stay exactly the answer, because voice
    // output and the message workspace read it.
    label.setAttribute('data-language', block.language || 'kod');
    label.setAttribute('aria-hidden', 'true');

    const copy = element(doc, 'button', 'md-code-copy');
    copy.setAttribute('type', 'button');
    copy.setAttribute('data-md-copy', 'code');
    copy.setAttribute('data-state', 'idle');
    copy.setAttribute('aria-label', 'Kod bloğunu kopyala');
    copy.setAttribute('title', 'Kod bloğunu panoya kopyala');

    head.appendChild(label);
    head.appendChild(copy);

    const pre = element(doc, 'pre', 'md-code-body');
    const code = element(doc, 'code');
    if (block.language) code.setAttribute('data-language', block.language);
    code.textContent = block.text;
    pre.appendChild(code);

    figure.appendChild(head);
    figure.appendChild(pre);
    return figure;
  }

  function renderTable(doc, block) {
    const wrap = element(doc, 'div', 'md-table-wrap');
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('tabindex', '0');
    wrap.setAttribute('aria-label', 'Tablo');

    const table = element(doc, 'table', 'md-table');
    const thead = element(doc, 'thead');
    const headRow = element(doc, 'tr');
    block.header.forEach((cell, column) => {
      const th = element(doc, 'th');
      th.setAttribute('scope', 'col');
      if (block.align[column]) th.setAttribute('data-align', block.align[column]);
      renderInlineInto(doc, th, cell);
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = element(doc, 'tbody');
    for (const row of block.rows) {
      const tr = element(doc, 'tr');
      row.forEach((cell, column) => {
        const td = element(doc, 'td');
        if (block.align[column]) td.setAttribute('data-align', block.align[column]);
        renderInlineInto(doc, td, cell);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  function renderBlocksInto(doc, parent, blocks, tight = false) {
    for (const block of blocks ?? []) {
      if (!block || typeof block !== 'object') continue;
      if (block.type === 'paragraph') {
        if (tight) {
          renderInlineInto(doc, parent, block.inline);
          continue;
        }
        const paragraph = element(doc, 'p', 'md-paragraph');
        renderInlineInto(doc, paragraph, block.inline);
        parent.appendChild(paragraph);
        continue;
      }
      if (block.type === 'heading') {
        const level = Math.min(6, Math.max(1, Number(block.level) || 1));
        const heading = element(doc, `h${level}`, `md-heading md-heading-${level}`);
        renderInlineInto(doc, heading, block.inline);
        parent.appendChild(heading);
        continue;
      }
      if (block.type === 'code') {
        parent.appendChild(renderCodeBlock(doc, block));
        continue;
      }
      if (block.type === 'divider') {
        parent.appendChild(element(doc, 'hr', 'md-divider'));
        continue;
      }
      if (block.type === 'quote') {
        const quote = element(doc, 'blockquote', 'md-quote');
        renderBlocksInto(doc, quote, block.blocks);
        parent.appendChild(quote);
        continue;
      }
      if (block.type === 'table') {
        parent.appendChild(renderTable(doc, block));
        continue;
      }
      if (block.type === 'list') {
        const list = element(doc, block.ordered ? 'ol' : 'ul', `md-list${block.tight ? ' md-list-tight' : ''}`);
        if (block.ordered && block.start !== 1) list.setAttribute('start', String(block.start));
        for (const item of block.items ?? []) {
          const li = element(doc, 'li', 'md-list-item');
          const single = block.tight && item.blocks.length === 1 && item.blocks[0].type === 'paragraph';
          renderBlocksInto(doc, li, item.blocks, single);
          list.appendChild(li);
        }
        parent.appendChild(list);
      }
    }
  }

  /**
   * Replaces `container`'s children with the rendered answer.
   * Falls back to a single text node when the text carries no markdown, when
   * a bound was hit before anything was produced, or when parsing yields
   * nothing — the answer is always readable.
   */
  function renderMarkdownInto(container, value, options = {}) {
    if (!container) return { rendered: false, truncated: false, blocks: 0 };
    const doc = options.document ?? container.ownerDocument;
    if (!doc || typeof doc.createElement !== 'function') return { rendered: false, truncated: false, blocks: 0 };

    const source = normalizeSource(value);
    const placeholder = typeof options.placeholder === 'string' ? options.placeholder : '';
    sourceByContainer.set(container, source);

    if (!source.trim()) {
      container.replaceChildren(doc.createTextNode(placeholder));
      container.removeAttribute('data-md');
      return { rendered: false, truncated: false, blocks: 0 };
    }

    const parsed = parseMarkdown(source);
    if (!parsed.blocks.length) {
      container.replaceChildren(doc.createTextNode(source));
      container.removeAttribute('data-md');
      return { rendered: false, truncated: parsed.truncated, blocks: 0 };
    }

    const fragment = doc.createDocumentFragment();
    renderBlocksInto(doc, fragment, parsed.blocks);
    container.replaceChildren(fragment);
    container.setAttribute('data-md', parsed.truncated ? 'truncated' : 'on');
    return { rendered: true, truncated: parsed.truncated, blocks: parsed.blocks.length };
  }

  /** Writes plain text into a container that may hold a previous render. */
  function renderPlainInto(container, value, options = {}) {
    if (!container) return false;
    const doc = options.document ?? container.ownerDocument;
    if (!doc || typeof doc.createTextNode !== 'function') return false;
    const source = normalizeSource(value);
    sourceByContainer.set(container, source);
    container.replaceChildren(doc.createTextNode(source || (options.placeholder ?? '')));
    container.removeAttribute('data-md');
    return true;
  }

  /** The markdown source last rendered into a container, for copy actions. */
  function sourceFor(container) {
    return sourceByContainer.get(container) ?? '';
  }

  return Object.freeze({
    LIMITS,
    SAFE_SCHEMES,
    normalizeSource,
    safeUrl,
    hasMarkdown,
    parseInline,
    parseMarkdown,
    toPlainText,
    renderMarkdownInto,
    renderPlainInto,
    sourceFor
  });
});
