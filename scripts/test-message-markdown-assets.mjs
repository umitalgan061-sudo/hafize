import assert from 'node:assert/strict';
import fs from 'node:fs';

const loader = fs.readFileSync(new URL('../public/composer-history-help.js', import.meta.url), 'utf8');
for (const asset of [
  '/message-markdown.css',
  '/message-markdown-tools.css',
  '/message-actions.css',
  '/message-outline.css',
  '/message-markdown.js',
  '/message-markdown-enhancement.js',
  '/message-markdown-tools.js',
  '/message-actions.js',
  '/message-outline.js',
  '/message-markdown-preferences.js'
]) assert.ok(loader.includes(asset), `missing loader asset ${asset}`);
assert.ok(loader.includes('loadAsset'));
assert.ok(loader.includes('data-hafize-asset'));
console.log('message markdown asset wiring contract ok');
