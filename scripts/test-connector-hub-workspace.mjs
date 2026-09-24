import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const nav = await readFile('public/workspace-navigation.js', 'utf8');
const index = await readFile('public/index.html', 'utf8');

assert.match(nav, /accountConnectionCard/);
assert.match(nav, /gmailConnectionCard/);
assert.match(nav, /canvaConnectionCard/);
assert.match(nav, /githubWriteReadinessCard/);
assert.match(nav, /connections:/);
assert.match(index, /connector-hub\.css/);
assert.match(index, /connector-hub\.js/);
assert.match(index, /github-workspace-details\.css/);
assert.match(index, /typed-build\/github-workspace-details\.js/);

const styleBeforeScript = index.indexOf('connector-hub.css');
const scriptIndex = index.indexOf('connector-hub.js');
assert.ok(styleBeforeScript >= 0 && scriptIndex >= 0);
assert.ok(styleBeforeScript < scriptIndex);

console.log('connector hub workspace integration: passed');