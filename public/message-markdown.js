(function exposeHafizeMarkdown(root) {
  'use strict';

  const MAX_INPUT = 24000;
  const MAX_BLOCKS = 240;
  const MAX_LINE = 1200;
  const MAX_TABLE_CELLS = 16;
  const URL_PATTERN = /^(https?:\/\/|mailto:)[^\s<>]+$/i;

  function safeUrl(value) {
    const url = String(value || '').trim();
    if (!URL_PATTERN.test(url)) return '';
    try {
      const parsed = new URL(url, root.location?.origin || 'http://localhost');
      if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) return '';
      return parsed.href;
    } catch {
      return '';
    }
  }

  function inline(doc, source) {
    const fragment = doc.createDocumentFragment();
    let text = '';
    const flush = () => { if (text) { fragment.append(doc.createTextNode(text)); text = ''; } };
    const input = String(source || '');
    for (let i = 0; i < input.length;) {
      if (input[i] === '`') {
        const end = input.indexOf('`', i + 1);
        if (end > i + 1) { flush(); const code = doc.createElement('code'); code.textContent = input.slice(i + 1, end); fragment.append(code); i = end + 1; continue; }
      }
      if (input.startsWith('**', i) || input.startsWith('__', i)) {
        const marker = input.slice(i, i + 2); const end = input.indexOf(marker, i + 2);
        if (end > i + 2) { flush(); const strong = doc.createElement('strong'); strong.append(...inline(doc, input.slice(i + 2, end)).childNodes); fragment.append(strong); i = end + 2; continue; }
      }
      if (input.startsWith('~~', i)) {
        const end = input.indexOf('~~', i + 2);
        if (end > i + 2) { flush(); const strike = doc.createElement('del'); strike.append(...inline(doc, input.slice(i + 2, end)).childNodes); fragment.append(strike); i = end + 2; continue; }
      }
      if (input[i] === '*' || input[i] === '_') {
        const marker = input[i]; const end = input.indexOf(marker, i + 1);
        if (end > i + 1 && !/\s/.test(input[i + 1])) { flush(); const em = doc.createElement('em'); em.append(...inline(doc, input.slice(i + 1, end)).childNodes); fragment.append(em); i = end + 1; continue; }
      }
      if (input[i] === '[') {
        const close = input.indexOf('](', i + 1); const end = close >= 0 ? input.indexOf(')', close + 2) : -1;
        if (end > close && close > i) {
          const href = safeUrl(input.slice(close + 2, end));
          if (href) { flush(); const link = doc.createElement('a'); link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.append(...inline(doc, input.slice(i + 1, close)).childNodes); fragment.append(link); i = end + 1; continue; }
        }
      }
      text += input[i++];
    }
    flush();
    return fragment;
  }

  function createTaskItem(doc, value) {
    const item = doc.createElement('li');
    const checked = /^\[[xX]\]\s+/.test(value);
    const unchecked = /^\[\s\]\s+/.test(value);
    if (checked || unchecked) {
      const box = doc.createElement('input'); box.type = 'checkbox'; box.checked = checked; box.disabled = true; box.setAttribute('aria-label', checked ? 'Tamamlandı' : 'Tamamlanmadı'); item.append(box, doc.createTextNode(' '));
      item.append(...inline(doc, value.slice(4).slice(0, MAX_LINE)).childNodes); return item;
    }
    item.append(...inline(doc, value.slice(0, MAX_LINE)).childNodes); return item;
  }

  function appendTable(doc, container, headerLine, dividerLine, rowLines) {
    const divider = dividerLine.split('|').map((cell) => cell.trim()).filter(Boolean);
    if (divider.length < 1 || divider.length > MAX_TABLE_CELLS || !divider.every((cell) => /^:?-{3,}:?$/.test(cell))) return false;
    const split = (line) => line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').slice(0, MAX_TABLE_CELLS).map((cell) => cell.trim());
    const headers = split(headerLine);
    if (!headers.length || headers.length > MAX_TABLE_CELLS || headers.length !== divider.length) return false;
    const table = doc.createElement('table');
    const thead = doc.createElement('thead'); const headRow = doc.createElement('tr');
    headers.forEach((cell) => { const th = doc.createElement('th'); th.scope = 'col'; th.append(...inline(doc, cell.slice(0, MAX_LINE)).childNodes); headRow.append(th); });
    thead.append(headRow); table.append(thead);
    const tbody = doc.createElement('tbody');
    for (const line of rowLines.slice(0, MAX_BLOCKS)) {
      if (!line.trim() || !line.includes('|')) continue;
      const cells = split(line); const tr = doc.createElement('tr');
      for (let index = 0; index < headers.length; index += 1) { const td = doc.createElement('td'); td.append(...inline(doc, (cells[index] || '').slice(0, MAX_LINE)).childNodes); tr.append(td); }
      tbody.append(tr);
    }
    table.append(tbody); container.append(table); return true;
  }

  function appendLine(doc, container, line, state) {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (/^\|?\s*[^|]+\|[^|]+\|?\s*$/.test(trimmed) && state.tableHeader === null) { state.tableHeader = trimmed; return true; }
    if (state.tableHeader !== null) {
      if (/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(trimmed)) {
        state.tableDivider = trimmed; state.tableRows = []; return true;
      }
      if (state.tableDivider !== null && trimmed.includes('|')) { state.tableRows.push(trimmed); return true; }
      if (state.tableDivider !== null && appendTable(doc, container, state.tableHeader, state.tableDivider, state.tableRows)) { state.tableHeader = null; state.tableDivider = null; state.tableRows = []; }
      else { state.tableHeader = null; state.tableDivider = null; state.tableRows = []; }
    }
    if (/^#{1,3}\s+/.test(trimmed)) {
      const match = /^(#{1,3})\s+(.+)$/.exec(trimmed); const level = match[1].length;
      const heading = doc.createElement(`h${level}`); heading.append(...inline(doc, match[2].slice(0, MAX_LINE)).childNodes); container.append(heading); return true;
    }
    if (/^[-*+]\s+/.test(trimmed)) {
      if (!state.list || state.listType !== 'ul') { state.list = doc.createElement('ul'); state.listType = 'ul'; container.append(state.list); }
      state.list.append(createTaskItem(doc, trimmed.slice(2))); return true;
    }
    if (/^\d+[.)]\s+/.test(trimmed)) {
      if (!state.list || state.listType !== 'ol') { state.list = doc.createElement('ol'); state.listType = 'ol'; container.append(state.list); }
      const item = doc.createElement('li'); item.append(...inline(doc, trimmed.replace(/^\d+[.)]\s+/, '').slice(0, MAX_LINE)).childNodes); state.list.append(item); return true;
    }
    state.list = null; state.listType = '';
    const paragraph = doc.createElement('p'); paragraph.append(...inline(doc, trimmed.slice(0, MAX_LINE)).childNodes); container.append(paragraph); return true;
  }

  function render(doc, input) {
    const rootNode = doc.createElement('div'); rootNode.className = 'markdown-body';
    const source = String(input ?? '').replace(/\0/g, '').slice(0, MAX_INPUT);
    const lines = source.replace(/\r\n?/g, '\n').split('\n');
    const state = { list: null, listType: '', tableHeader: null, tableDivider: null, tableRows: [] };
    let blocks = 0;
    for (let i = 0; i < lines.length && blocks < MAX_BLOCKS; i += 1) {
      const line = lines[i].slice(0, MAX_LINE);
      if (/^\s*```/.test(line)) {
        state.tableHeader = null; state.tableDivider = null; state.tableRows = []; state.list = null; state.listType = '';
        const lang = line.replace(/^\s*```/, '').trim().slice(0, 24); const code = []; i += 1;
        while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) { code.push(lines[i].slice(0, MAX_LINE)); i += 1; }
        const pre = doc.createElement('pre'); const codeNode = doc.createElement('code'); if (lang) codeNode.dataset.language = lang;
        codeNode.textContent = code.join('\n').slice(0, MAX_INPUT); pre.append(codeNode); rootNode.append(pre); blocks += 1; continue;
      }
      if (/^\s*>\s?/.test(line)) { state.tableHeader = null; state.tableDivider = null; state.tableRows = []; state.list = null; state.listType = ''; const quote = doc.createElement('blockquote'); quote.append(...inline(doc, line.replace(/^\s*>\s?/, '').slice(0, MAX_LINE)).childNodes); rootNode.append(quote); blocks += 1; continue; }
      if (/^\s*---+\s*$/.test(line)) { state.tableHeader = null; state.tableDivider = null; state.tableRows = []; state.list = null; state.listType = ''; rootNode.append(doc.createElement('hr')); blocks += 1; continue; }
      if (appendLine(doc, rootNode, line, state)) blocks += 1;
    }
    if (state.tableHeader !== null && state.tableDivider !== null) appendTable(doc, rootNode, state.tableHeader, state.tableDivider, state.tableRows);
    return rootNode;
  }

  const api = Object.freeze({ MAX_INPUT, MAX_BLOCKS, MAX_LINE, safeUrl, render });
  root.HafizeMarkdown = api;
  if (typeof module === 'object' && module?.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : self);
