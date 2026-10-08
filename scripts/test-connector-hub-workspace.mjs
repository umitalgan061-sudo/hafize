import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertModuleShipped, assertStylesheetShipped } from './shell-cache-contract.mjs';

const nav = await readFile('public/typed/workspace-navigation.ts', 'utf8');
const index = await readFile('public/index.html', 'utf8');

assert.match(nav, /accountConnectionCard/);
assert.match(nav, /gmailConnectionCard/);
assert.match(nav, /canvaConnectionCard/);
assert.match(nav, /githubWriteReadinessCard/);
assert.match(nav, /connections:/);
assertStylesheetShipped('/connector-hub.css');
assertModuleShipped('connector-hub');
assertStylesheetShipped('/github-workspace-details.css');
assertModuleShipped('github-workspace-details');

// Styles are linked before the bundle that mounts the panel, so the first paint
// is already styled.
const styleBeforeScript = index.indexOf('connector-hub.css');
const scriptIndex = index.indexOf('/typed-build/legacy-app.js');
assert.ok(styleBeforeScript >= 0 && scriptIndex >= 0);
assert.ok(styleBeforeScript < scriptIndex);

console.log('connector hub workspace integration: passed');