import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const sw = require('../public/sw-policy.js');
const uiShell = require('../public/ui-shell.js');
const uiSource = await readFile(new URL('../public/ui-shell.js', import.meta.url), 'utf8');

assert.equal(sw.CURRENT_CACHE, 'hafize-shell-v85');
assert.equal(sw.SHELL_ASSETS.includes('/schedule-list-filter.js'), true);
assert.equal(sw.SHELL_ASSETS.includes('/schedule-list-filter.css'), true);
assert.equal(new Set(sw.SHELL_ASSETS).size, sw.SHELL_ASSETS.length, 'shell asset list must not contain duplicates');

const origin = 'https://hafize.example';
function request(pathname, { method = 'GET', accept = 'text/javascript' } = {}) {
  return {
    method,
    url: `${origin}${pathname}`,
    mode: 'cors',
    headers: { get(name) { return name.toLowerCase() === 'accept' ? accept : ''; } }
  };
}
assert.equal(sw.classifyRequest(request('/schedule-list-filter.js'), origin), 'shell');
assert.equal(sw.classifyRequest(request('/schedule-list-filter.css', { accept: 'text/css' }), origin), 'shell');
assert.equal(sw.classifyRequest(request('/api/schedules?view=summary'), origin), 'network-only');
assert.equal(sw.classifyRequest(request('/schedule-list-filter.js', { method: 'POST' }), origin), 'ignore');
assert.equal(sw.classifyRequest({ ...request('/schedule-list-filter.js'), url: 'https://evil.example/schedule-list-filter.js' }, origin), 'ignore');

assert.equal(uiShell.SCHEDULE_LIST_FILTER_SCRIPT, '/schedule-list-filter.js');
assert.equal(typeof uiShell.installScheduleListFilterAsset, 'function');
assert.match(uiSource, /hafizeScheduleListFilterScript/);
assert.match(uiSource, /documentRef\.getElementById\?\.\(SCHEDULE_LIST_FILTER_SCRIPT_ID\)/);

function fakeDocument(existing = false) {
  const children = [];
  const head = { append(node) { children.push(node); } };
  return {
    head,
    children,
    createElement() { return {}; },
    getElementById(id) { return existing && id === 'hafizeScheduleListFilterScript' ? {} : null; }
  };
}

const documentRef = fakeDocument(false);
assert.equal(uiShell.installScheduleListFilterAsset(documentRef), true);
assert.equal(documentRef.children.length, 1);
assert.equal(documentRef.children[0].id, 'hafizeScheduleListFilterScript');
assert.equal(documentRef.children[0].src, '/schedule-list-filter.js');
assert.equal(documentRef.children[0].async, false);
assert.equal(uiShell.installScheduleListFilterAsset(documentRef), true, 'fake document has no dynamic id lookup; source-level idempotence is checked separately');

const existingDocument = fakeDocument(true);
assert.equal(uiShell.installScheduleListFilterAsset(existingDocument), false);
assert.equal(existingDocument.children.length, 0);

console.log('schedule list filter PWA tests passed');