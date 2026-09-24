import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile('public/connector-hub.js', 'utf8');
const nav = await readFile('public/workspace-navigation.js', 'utf8');
const sw = await readFile('public/sw-policy.js', 'utf8');
const index = await readFile('public/index.html', 'utf8');

const requiredCards = [
  'accountConnectionCard',
  'gmailConnectionCard',
  'canvaConnectionCard',
  'githubWriteReadinessCard'
];

for (const id of requiredCards) {
  assert.match(source, new RegExp(id));
  assert.match(nav, new RegExp(id));
  assert.match(index, /connector-hub\.js/);
}

assert.match(source, /CAPABILITIES/);
assert.match(source, /repository\.read/);
assert.match(source, /gmail\.read/);
assert.match(source, /asset\.read/);
assert.match(source, /Tanı özetini kopyala/);
assert.match(source, /navigator\?\.clipboard/);
assert.match(source, /lines\.join\(['"]\\n['"]\)/);
assert.match(source, /lastSnapshot/);
assert.match(source, /connectedCount/);
assert.match(source, /hafize:connector-hub-changed/);
assert.match(sw, /connector-hub\.css/);
assert.match(sw, /connector-hub\.js/);

const css = await readFile('public/connector-hub.css', 'utf8');
assert.match(css, /connector-hub-capability/);
assert.match(css, /connector-hub-refresh/);
assert.match(css, /connector-hub-toggle/);
assert.match(css, /forced|focus|700px/);

console.log('connector hub regression: passed');