import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/code-block-download.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {}, self: {} });
const api = module.exports;

for (const value of ['', 'unknown', 'tsx', '<script>', '../js', 'a'.repeat(40)]) {
  const language = api.languageOf({ dataset: { language: value } });
  if (language && Object.hasOwn(api.EXTENSIONS, language)) continue;
  assert.equal(api.extensionFor(language), 'txt');
  assert.equal(api.filenameFor(language), 'hafize-code.txt');
}

const code = { textContent: 'ok', dataset: { language: 'js' } };
const noShellPre = {
  dataset: {},
  querySelector(selector) { assert.equal(selector, ':scope > code'); return code; },
  closest(selector) { assert.equal(selector, '.hafize-code-shell'); return null; }
};
const documentRef = { querySelector() { return null; }, createElement() { throw new Error('should not create'); } };
const controller = api.createController({ documentRef, setTimeoutImpl() { return 1; }, clearTimeoutImpl() {} });
assert.equal(controller.decorate(noShellPre), false);
assert.equal(noShellPre.dataset[api.MARKER], undefined);
assert.equal(controller.decorate(null), false);
assert.equal(controller.decorate({ dataset: { [api.MARKER]: '1' }, querySelector() {} }), false);

assert.equal(api.codeText('\u0000'), '');
assert.equal(api.codeText(''), '');
assert.equal(api.codeText(undefined), null);
console.log('code block download edge cases ok');
