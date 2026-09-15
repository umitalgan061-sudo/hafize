(function exposeHafizeMarkdown(root) {
  'use strict';

  const MAX_INPUT = 24000;
  const MAX_BLOCKS = 240;
  const MAX_LINE = 1200;
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
        if (end > i + 1) {
          flush(); const code = doc.createElement('code'); code.textContent = input.slice(i + 1, end); fragment.append(code); i = end + 1; continue;
        }
      }
      if (input.startsWith('**', i) || input.startsWith('__', i)) {
        const marker = input.slice(i, i + 2); const end = input.indexOf(marker, i + 2);
        if (end > i + 2) {
          flush(); const strong = doc.createElement('strong'); strong.append(...inline(doc, input.slice(i + 2, end)).childNodes); fragment.append(strong); i = end + 2; continue;
        }
      }
      if (input[i] === '*' || input[i] === '_') {
        const marker = input[i]; const end = input.indexOf(marker, i + 1);
        if (end > i + 1 && !/\s/.test(input[i + 1])) {
          flush(); const em = doc.createElement('em'); em.append(...inline(doc, input.slice(i + 1, end)).childNodes); fragment.append(em); i = end + 1; continue;
        }
      }
      if (input[i] === '[') {
        const close = input.indexOf('](', i + 1); const end = close >= 0 ? input.indexOf(')', close + 2) : -1;
        if (end > close && close > i) {
          const href = safeUrl(input.slice(close + 2, end));
          if (href) {
            flush(); const link = doc.createElement('a'); link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer';
            link.append(...inline(doc, input.slice(i + 1, close)).childNodes); fragment.append(link); i = end + 1; continue;
          }
        }
      }
      text += input[i++];
    }
    flush();
    return fragment;
  }

  function appendLine(doc, container, line, state) {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (/^#{1,3}\s+/.test(trimmed)) {
      const match = /^(#{1,3})\s+(.+)$/.exec(trimmed); const level = match[1].length;
      const heading = doc.createElement(`h${level}`); heading.append(...inline(doc, match[2].slice(0, MAX_LINE)).childNodes); container.append(heading); return true;
    }
    if (/^[-*+]\s+/.test(trimmed)) {
      if (!state.list || state.listType !== 'ul') { state.list = doc.createElement('ul'); state.listType = 'ul'; container.append(state.list); }
      const item = doc.createElement('li'); item.append(...inline(doc, trimmed.slice(2, MAX_LINE)).childNodes); state.list.append(item); return true;
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
    const state = { list: null, listType: '' };
    let blocks = 0;
    for (let i = 0; i < lines.length && blocks < MAX_BLOCKS; i += 1) {
      let line = lines[i].slice(0, MAX_LINE);
      if (/^\s*```/.test(line)) {
        state.list = null; state.listType = '';
        const lang = line.replace(/^\s*```/, '').trim().slice(0, 24);
        const code = [];
        i += 1;
        while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) { code.push(lines[i].slice(0, MAX_LINE)); i += 1; }
        const pre = doc.createElement('pre'); const codeNode = doc.createElement('code');
        if (lang) codeNode.dataset.language = lang;
        codeNode.textContent = code.join('\n').slice(0, MAX_INPUT); pre.append(codeNode); rootNode.append(pre); blocks += 1; continue;
      }
      if (/^\s*>\s?/.test(line)) {
        state.list = null; state.listType = '';
        const quote = doc.createElement('blockquote'); quote.append(...inline(doc, line.replace(/^\s*>\s?/, '').slice(0, MAX_LINE)).childNodes); rootNode.append(quote); blocks += 1; continue;
      }
      if (/^\s*---+\s*$/.test(line)) { state.list = null; state.listType = ''; rootNode.append(doc.createElement('hr')); blocks += 1; continue; }
      if (appendLine(doc, rootNode, line, state)) blocks += 1;
    }
    return rootNode;
  }

  const api = Object.freeze({ MAX_INPUT, safeUrl, render });
  root.HafizeMarkdown = api;
  if (typeof module === 'object' && module?.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : self);
