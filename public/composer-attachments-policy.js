(function exposeHafizeComposerAttachmentPolicy(root) {
  'use strict';
  const MAX_FILES = 4;
  const MAX_BYTES = 256 * 1024;
  const MAX_TEXT_CHARS = 80_000;
  const MAX_COMBINED_CHARS = 200_000;
  const MAX_INSERT_CHARS = 11_500;
  const MAX_NAME = 120;
  const MAX_PREVIEW_LINES = 12;
  const ALLOWED_EXTENSIONS = Object.freeze(['txt','md','markdown','json','jsonl','csv','tsv','js','mjs','cjs','ts','tsx','jsx','css','scss','html','htm','xml','yaml','yml','toml','ini','conf','py','pyw','java','kt','kts','c','h','cpp','hpp','cc','cs','go','rs','rb','php','swift','sh','bash','zsh','fish','ps1','sql','graphql','gql','log']);
  const LANGUAGE_MAP = Object.freeze({txt:'text',md:'markdown',markdown:'markdown',json:'json',jsonl:'json',csv:'csv',tsv:'text',ts:'typescript',tsx:'tsx',js:'javascript',mjs:'javascript',cjs:'javascript',jsx:'jsx',css:'css',scss:'scss',html:'html',htm:'html',xml:'xml',yaml:'yaml',yml:'yaml',toml:'toml',ini:'ini',conf:'text',py:'python',pyw:'python',java:'java',kt:'kotlin',kts:'kotlin',c:'c',h:'c',cpp:'cpp',hpp:'cpp',cc:'cpp',cs:'csharp',go:'go',rs:'rust',rb:'ruby',php:'php',swift:'swift',sh:'shell',bash:'shell',zsh:'shell',fish:'shell',ps1:'powershell',sql:'sql',graphql:'graphql',gql:'graphql',log:'text'});
  const clampText = (value, limit = MAX_TEXT_CHARS) => String(value ?? '').replace(/\0/g, '').slice(0, limit);
  const safeName = (value) => String(value ?? '').replace(/[\\/]+/g, '_').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, MAX_NAME) || 'dosya';
  const extensionOf = (name) => { const value = safeName(name).toLocaleLowerCase('en-US'); const index = value.lastIndexOf('.'); return index >= 0 ? value.slice(index + 1) : ''; };
  const languageOf = (name) => LANGUAGE_MAP[extensionOf(name)] || 'text';
  const byteSizeOf = (file) => Number.isFinite(file?.size) ? file.size : 0;
  function binaryScore(text) { if (!text) return 0; let suspicious = 0; for (const char of String(text).slice(0, 32000)) { const code = char.charCodeAt(0); if (code === 0 || code < 9 || (code > 13 && code < 32)) suspicious += 1; } return suspicious / Math.max(1, String(text).length); }
  function validateFile(file, existing = []) {
    const name = safeName(file?.name); const extension = extensionOf(name); const size = byteSizeOf(file);
    if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) return { ok: false, reason: 'type', name };
    if (size <= 0) return { ok: false, reason: 'empty', name };
    if (size > MAX_BYTES) return { ok: false, reason: 'size', name };
    const duplicate = existing.some((item) => item?.name === name && item?.size === size && item?.lastModified === Number(file?.lastModified || 0));
    if (duplicate) return { ok: false, reason: 'duplicate', name };
    return { ok: true, name, extension, size };
  }
  async function readText(file) {
    if (!file) throw new Error('FILE_REQUIRED');
    if (typeof file.text === 'function') return clampText(await file.text());
    return await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(clampText(reader.result)); reader.onerror = () => reject(new Error('FILE_READ_FAILED')); reader.readAsText(file); });
  }
  function normalizeContent(text) { return clampText(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/[\t ]+$/gm, '').trim(); }
  function previewLines(content) { return normalizeContent(content).split('\n').slice(0, MAX_PREVIEW_LINES); }
  function formatForComposer(item) {
    const body = normalizeContent(item?.content); if (!body) return '';
    const fence = String(body).includes('```') ? '````' : '```';
    return `\n\n[Dosya: ${safeName(item.name)}]\n${fence}${languageOf(item.name)}\n${body}\n${fence}`;
  }
  function totalChars(items) { return (Array.isArray(items) ? items : []).reduce((sum, item) => sum + normalizeContent(item?.content).length, 0); }
  function insertionSize(items) { return (Array.isArray(items) ? items : []).reduce((sum, item) => sum + formatForComposer(item).length, 0); }
  root.HafizeComposerAttachmentPolicy = Object.freeze({ MAX_FILES, MAX_BYTES, MAX_TEXT_CHARS, MAX_COMBINED_CHARS, MAX_INSERT_CHARS, MAX_NAME, MAX_PREVIEW_LINES, ALLOWED_EXTENSIONS, clampText, safeName, extensionOf, languageOf, binaryScore, validateFile, readText, normalizeContent, previewLines, formatForComposer, totalChars, insertionSize });
})(typeof globalThis !== 'undefined' ? globalThis : self);