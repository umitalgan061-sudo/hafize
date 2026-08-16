import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/code-block-copy.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {}, self: {} });
const api = module.exports;

assert.equal(api.codeText('a\r\nb\rc'), 'a\nb\nc');
assert.equal(api.codeText(''), '');
assert.equal(api.codeText('x'.repeat(api.MAX_CODE_CHARS + 1)), null);
assert.equal(api.languageLabel({ dataset: { language: 'js' } }), 'js');
assert.equal(api.languageLabel({ dataset: { language: 'c++' } }), 'c++');
assert.equal(api.languageLabel({ dataset: { language: 'bad value' } }), '');
assert.equal(api.languageLabel({ dataset: { language: 'x'.repeat(33) } }), '');

const clipboardWrites = [];
const button = { dataset: {}, disabled: false, textContent: '' };
const controller = api.createController({
  documentRef: { querySelector() { return null; } },
  clipboard: { async writeText(value) { clipboardWrites.push(value); } },
  secureContext: true,
  setTimeoutImpl(fn) { return { fn }; },
  clearTimeoutImpl() {}
});
assert.equal(await controller.copy(button, { textContent: 'const x = 1;\r\n' }), true);
assert.deepEqual(clipboardWrites, ['const x = 1;\n']);
assert.equal(button.dataset.state, 'success');

const insecure = api.createController({
  documentRef: { querySelector() { return null; } },
  clipboard: { async writeText() { throw new Error('should not run'); } },
  secureContext: false,
  setTimeoutImpl(fn) { return { fn }; },
  clearTimeoutImpl() {}
});
const insecureButton = { dataset: {}, disabled: false, textContent: '' };
assert.equal(await insecure.copy(insecureButton, { textContent: 'x' }), false);
assert.equal(insecureButton.dataset.state, 'error');

assert.ok(!source.includes('fetch('));
assert.ok(!source.includes('WebSocket'));
assert.ok(!source.includes('XMLHttpRequest'));
assert.ok(!source.includes('localStorage'));
assert.ok(!source.includes('sessionStorage'));
assert.ok(!source.includes('document.cookie'));
assert.ok(!source.includes('requestSubmit'));
assert.ok(!source.includes('.click()'));
assert.ok(!source.includes('innerHTML'));
assert.match(source, /navigator\?\.clipboard|navigator\.clipboard|clipboard/);
assert.match(source, /\.message\.assistant \.content\.hafize-markdown pre/);

const loader = fs.readFileSync(new URL('../public/chat-run-controller.js', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../public/sw-policy.js', import.meta.url), 'utf8');
assert.match(loader, /HafizeCodeBlockCopy/);
assert.match(loader, /\/code-block-copy\.js/);
assert.match(sw, /hafize-shell-v35/);
assert.match(sw, /'\/code-block-copy\.js'/);
assert.match(sw, /pathname\.startsWith\('\/api\/'\).*network-only/s);

console.log('code block copy contract ok');