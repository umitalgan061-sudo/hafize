import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFile(path.join(root, file), 'utf8');
const html = await read('public/index.html');
const js = await read('public/message-workspace.js');
const css = await read('public/message-workspace.css');
const policy = await read('public/message-workspace-policy.js');
const sw = await read('public/sw-policy.js');

function count(text, needle) {
  return text.split(needle).length - 1;
}

assert.equal(count(html, '/message-workspace.css'), 1);
assert.equal(count(html, '/message-workspace-policy.js'), 1);
assert.equal(count(html, '/message-workspace.js'), 1);
assert.ok(html.indexOf('/message-workspace-policy.js') < html.indexOf('/message-workspace.js'));

for (const asset of [
  '/message-workspace.css',
  '/message-workspace-policy.js',
  '/message-workspace.js'
]) {
  assert.equal(count(sw, asset), 1, `shell asset missing exactly once: ${asset}`);
}

assert.match(sw, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v\d+`/);
assert.match(sw, /SHELL_ASSETS = Object\.freeze\(\[/);
assert.ok(sw.includes("'/message-workspace.css'"));
assert.ok(sw.includes("'/message-workspace-policy.js'"));
assert.ok(sw.includes("'/message-workspace.js'"));

assert.ok(js.includes("hafize.message-workspace.v1"));
assert.ok(js.includes("hafize:message-workspace-changed"));
assert.ok(js.includes('MutationObserver'));
assert.ok(js.includes('localStorage'));
assert.ok(js.includes('message-save'));
assert.ok(js.includes('message-feedback-up'));
assert.ok(js.includes('message-feedback-down'));
assert.ok(js.includes('message-note'));
assert.ok(js.includes('message-tag'));
assert.ok(js.includes('message-more'));
assert.ok(js.includes('JSON dışa aktar'));
assert.ok(js.includes('Mesaja git'));
assert.ok(js.includes('Görünenleri seç'));
assert.ok(js.includes("key==='b'"));
assert.ok(js.includes("key==='k'"));
assert.ok(js.includes("key==='x'"));

assert.ok(css.includes('.message-workspace-panel'));
assert.ok(css.includes('.message-workspace-actions'));
assert.ok(css.includes('.message-workspace-result'));
assert.ok(css.includes('prefers-reduced-motion:reduce'));
assert.ok(css.includes('forced-colors:active'));

assert.ok(policy.includes('MAX_RECORDS = 240'));
assert.ok(policy.includes('MAX_NOTE = 600'));
assert.ok(policy.includes('MAX_TAGS = 8'));
assert.ok(policy.includes('MAX_EXPORT = 100'));
assert.ok(policy.includes('normalizeRecords'));
assert.ok(policy.includes('canExport'));
assert.ok(policy.includes('toggleSaved'));
assert.ok(policy.includes('toggleFeedback'));
assert.ok(policy.includes('replaceNote'));
assert.ok(policy.includes('replaceTags'));

for (const source of [js, css, policy]) {
  assert.ok(!source.includes('.innerHTML'));
  assert.ok(!source.includes('.outerHTML'));
  assert.ok(!source.includes('insertAdjacentHTML'));
  assert.ok(!source.includes('document.write'));
  assert.ok(!source.includes('indexedDB'));
  assert.ok(!source.includes('document.cookie'));
}

assert.ok(!js.includes('/api/'));
assert.ok(!js.includes('fetch('));
assert.ok(!js.includes('XMLHttpRequest'));
assert.ok(!js.includes('WebSocket'));
assert.ok(!js.includes('Authorization'));
assert.ok(!js.includes('Bearer '));
assert.ok(!js.includes('.env'));
assert.ok(!policy.includes('fetch('));

const dangerousPatterns = [
  /localStorage\.setItem\([^\n]+password/i,
  /localStorage\.setItem\([^\n]+token/i,
  /localStorage\.setItem\([^\n]+secret/i,
  /localStorage\.setItem\([^\n]+credential/i
];
for (const pattern of dangerousPatterns) assert.ok(!pattern.test(js), `forbidden persistence pattern: ${pattern}`);

assert.ok(js.includes('Blob('));
assert.ok(js.includes('URL.createObjectURL'));
assert.ok(js.includes('URL.revokeObjectURL'));
assert.ok(js.includes('application/json'));
assert.ok(js.includes("slice(0,MAX_EXPORT)"));
assert.ok(js.includes("slice(0,12000)"));

console.log('message workspace source contract tests passed');
