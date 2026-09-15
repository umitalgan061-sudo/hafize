import assert from 'node:assert/strict';
import fs from 'node:fs';

const policy = fs.readFileSync(new URL('../public/sw-policy.js', import.meta.url), 'utf8');
const loader = fs.readFileSync(new URL('../public/composer-history-help.js', import.meta.url), 'utf8');
const assets = [
  '/message-markdown.css',
  '/message-markdown.js',
  '/message-markdown-enhancement.js',
  '/message-markdown-tools.css',
  '/message-markdown-tools.js',
  '/message-actions.css',
  '/message-actions.js',
  '/message-outline.css',
  '/message-outline.js'
];
for (const asset of assets) {
  assert.ok(policy.includes(asset), `PWA shell missing ${asset}`);
  assert.ok(loader.includes(asset), `runtime loader missing ${asset}`);
}
assert.match(policy, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v35`/);
console.log('markdown and message action PWA contract ok');
