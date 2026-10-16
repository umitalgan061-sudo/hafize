import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertShippedBrowserModule, assertShippedStylesheet } from './shell-cache-contract.mjs';

const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const sw = await readFile(new URL('../public/sw-policy.ts', import.meta.url), 'utf8');
assertShippedStylesheet('scheduled-task-preview.css');
assertShippedBrowserModule('scheduled-task-preview');
assertShippedStylesheet('scheduled-task-duplicate.css');
assertShippedBrowserModule('scheduled-task-duplicate');
assertShippedStylesheet('scheduled-task-templates.css');
assertShippedBrowserModule('scheduled-task-templates');
assertShippedStylesheet('scheduled-task-planning.css');
assertShippedBrowserModule('scheduled-task-planning');
assert.match(sw, /v43|v44/);
console.log('scheduled-task-preview-assets: ok');
