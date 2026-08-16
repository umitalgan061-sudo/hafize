import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const search = require('../public/conversation-search.js');
const swPolicy = require('../public/sw-policy.js');

function row(title) {
  return {
    hidden: false,
    querySelector(selector) {
      if (selector !== '.conversation-open') return null;
      return { textContent: title };
    }
  };
}

assert.equal(search.MAX_QUERY_CHARS, 120);
assert.equal(search.MAX_TITLE_CHARS, 512);
assert.equal(search.normalizeQuery('  Ankara   Planı  '), 'ankara planı');
assert.equal(search.normalizeQuery('İSTANBUL'), 'istanbul');
assert.equal(search.normalizeQuery(''), '');
assert.equal(search.normalizeQuery(null), null);
assert.equal(search.normalizeQuery('x'.repeat(121)), null);

const rows = [row('Ankara gezi planı'), row('Westeros geliştirme'), row('Gmail güvenliği')];
let result = search.filterRows(rows, 'geliştirme');
assert.deepEqual(result, { ok: true, total: 3, visible: 1, query: 'geliştirme' });
assert.deepEqual(rows.map((item) => item.hidden), [true, false, true]);

result = search.filterRows(rows, 'GMAİL');
assert.deepEqual(result, { ok: true, total: 3, visible: 1, query: 'gmail' });
assert.deepEqual(rows.map((item) => item.hidden), [true, true, false]);

result = search.filterRows(rows, 'bulunmayan');
assert.equal(result.visible, 0);
assert.deepEqual(rows.map((item) => item.hidden), [true, true, true]);

result = search.filterRows(rows, '');
assert.equal(result.visible, 3);
assert.deepEqual(rows.map((item) => item.hidden), [false, false, false]);

result = search.filterRows(rows, 'x'.repeat(121));
assert.deepEqual(result, { ok: false, total: 3, visible: 3, query: '' });
assert.deepEqual(rows.map((item) => item.hidden), [false, false, false], 'invalid search must fail open without hiding history');

const oversizedTitle = row('x'.repeat(513));
assert.equal(search.normalizedTitle(oversizedTitle), '');
assert.equal(search.filterRows([oversizedTitle], 'x').visible, 0);
assert.equal(search.normalizedTitle({ querySelector() { return null; } }), '');

const sourcePath = fileURLToPath(new URL('../public/conversation-search.js', import.meta.url));
const loaderPath = fileURLToPath(new URL('../public/chat-run-controller.js', import.meta.url));
const policyPath = fileURLToPath(new URL('../public/sw-policy.js', import.meta.url));
const docPath = fileURLToPath(new URL('../docs/CONVERSATION_SEARCH_SECURITY.md', import.meta.url));
const [source, loader, policy, doc] = await Promise.all([
  readFile(sourcePath, 'utf8'),
  readFile(loaderPath, 'utf8'),
  readFile(policyPath, 'utf8'),
  readFile(docPath, 'utf8')
]);

for (const path of [sourcePath, loaderPath, policyPath]) {
  const syntax = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout || `${path} syntax check failed`);
}

for (const forbidden of [
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /document\.cookie/,
  /\bfetch\s*\(/,
  /\bWebSocket\b/,
  /navigator\.clipboard/,
  /\.content\b/,
  /data-message-id/,
  /Authorization/i,
  /HAFIZE_.*(?:TOKEN|KEY|SECRET)/
]) {
  assert.equal(forbidden.test(source), false, `conversation search must not expose forbidden surface: ${forbidden}`);
}

assert.equal(source.includes("querySelector?.('.conversation-open')"), true, 'search corpus must be rendered conversation titles only');
assert.equal(source.includes("observer.observe(list, { childList: true, subtree: true })"), true, 'filter must survive app list rerenders');
assert.equal(source.includes("event.key !== 'Escape'"), true, 'Escape clear behavior must remain explicit');
assert.equal(source.includes("field.maxLength = MAX_QUERY_CHARS"), true);
assert.equal(source.includes("field.autocomplete = 'off'"), true);
assert.equal(source.includes("state.setAttribute('aria-live', 'polite')"), true);
assert.equal(source.includes("field.setAttribute('aria-controls', 'conversationList')"), true);

assert.equal(loader.includes("loadShellEnhancement('HafizeConversationSearch', '/conversation-search.js', 'data-hafize-conversation-search')"), true);
assert.equal(loader.split("'/conversation-search.js'").length - 1, 1, 'conversation search loader must be exact-once');
assert.equal(swPolicy.CURRENT_CACHE, 'hafize-shell-v22');
assert.equal(swPolicy.SHELL_ASSETS.includes('/conversation-search.js'), true);
assert.equal(swPolicy.classifyRequest({
  method: 'GET',
  url: 'https://hafize.example/api/chat',
  headers: { accept: 'application/json' },
  mode: 'cors'
}, 'https://hafize.example'), 'network-only');
assert.equal(swPolicy.classifyRequest({
  method: 'GET',
  url: 'https://hafize.example/conversation-search.js',
  headers: {},
  mode: 'cors'
}, 'https://hafize.example'), 'shell');

assert.match(doc, /yalnız.*sohbet başlık/i);
assert.match(doc, /mesaj gövdes/i);
assert.match(doc, /localStorage/i);
assert.match(doc, /ağ isteği/i);
assert.match(doc, /120/);

console.log('conversation search security tests passed');
