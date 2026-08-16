import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/code-block-copy.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {}, self: {} });
const api = module.exports;

assert.equal(api.codeText(null), null);
assert.equal(api.codeText(undefined), null);
assert.equal(api.codeText('   '), '   ');
assert.equal(api.languageLabel({ dataset: { language: 'ts' } }), 'ts');
assert.equal(api.languageLabel({ dataset: { language: '.net' } }), '.net');
assert.equal(api.languageLabel({ dataset: { language: '<script>' } }), '');

const rejected = api.createController({
  documentRef: { querySelector() { return null; } },
  clipboard: { async writeText() { throw new Error('clipboard denied'); } },
  secureContext: true,
  setTimeoutImpl(fn) { return { fn }; },
  clearTimeoutImpl() {}
});
const button = { dataset: {}, disabled: false, textContent: '' };
assert.equal(await rejected.copy(button, { textContent: 'x' }), false);
assert.equal(button.dataset.state, 'error');

const oversizedButton = { dataset: {}, disabled: false, textContent: '' };
assert.equal(await rejected.copy(oversizedButton, { textContent: 'x'.repeat(api.MAX_CODE_CHARS + 1) }), false);
assert.equal(oversizedButton.dataset.state, 'error');

assert.doesNotMatch(source, /eval\(/);
assert.doesNotMatch(source, /new Function/);
assert.doesNotMatch(source, /sendBeacon/);
assert.doesNotMatch(source, /indexedDB/);
assert.doesNotMatch(source, /postMessage/);
assert.doesNotMatch(source, /location\s*=/);
assert.doesNotMatch(source, /window\.open/);
assert.match(source, /secureContext/);
assert.match(source, /writeText/);
assert.match(source, /aria-label/);
assert.match(source, /MutationObserver/);

console.log('code block copy edge cases ok');