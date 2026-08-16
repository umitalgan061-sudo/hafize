import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/code-block-download.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {}, self: {} });
const api = module.exports;

assert.equal(api.codeText(null), null);
assert.equal(api.codeText('a\r\nb\rc\u0000'), 'a\nb\nc');
assert.equal(api.codeText('x'.repeat(api.MAX_CODE_CHARS + 1)), null);
assert.equal(api.codeText('x'.repeat(api.MAX_CODE_CHARS)).length, api.MAX_CODE_CHARS);
assert.equal(api.languageOf({ dataset: { language: ' TypeScript ' } }), 'typescript');
assert.equal(api.languageOf({ dataset: { language: '<script>' } }), '');
assert.equal(api.languageOf({ dataset: {} }), '');
assert.equal(api.extensionFor('javascript'), 'js');
assert.equal(api.extensionFor('typescript'), 'ts');
assert.equal(api.extensionFor('python'), 'py');
assert.equal(api.extensionFor('rust'), 'rs');
assert.equal(api.extensionFor('unknown'), 'txt');
assert.equal(api.filenameFor('json'), 'hafize-code.json');
assert.equal(api.filenameFor('unknown'), 'hafize-code.txt');

const forbidden = [
  'fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon',
  'localStorage', 'sessionStorage', 'document.cookie', 'navigator.clipboard',
  'requestSubmit', '.submit(', 'eval(', 'innerHTML'
];
for (const token of forbidden) assert.equal(source.includes(token), false, `forbidden API: ${token}`);
assert.match(source, /BlobImpl/);
assert.match(source, /createObjectURL/);
assert.match(source, /revokeObjectURL/);
assert.match(source, /anchor\.remove/);
assert.match(source, /rel = 'noopener'/);
assert.match(source, /\.message\.assistant \.content\.hafize-markdown pre/);
console.log('code block download contract ok');
