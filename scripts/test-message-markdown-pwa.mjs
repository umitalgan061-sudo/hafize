import assert from 'node:assert/strict';
import fs from 'node:fs';

const policy = fs.readFileSync(new URL('../public/sw-policy.js', import.meta.url), 'utf8');
const loader = fs.readFileSync(new URL('../public/composer-history-help.js', import.meta.url), 'utf8');
for (const asset of ['/message-markdown.css', '/message-markdown.js', '/message-markdown-enhancement.js', '/message-markdown-tools.css', '/message-markdown-tools.js']) {
  assert.ok(policy.includes(asset), `missing PWA asset: ${asset}`);
  assert.ok(loader.includes(asset), `missing runtime asset: ${asset}`);
}
assert.ok(policy.includes('v34'));
assert.ok(policy.includes('SHELL_ASSETS'));
assert.ok(policy.includes("pathname.startsWith('/api/')"));
console.log('message markdown PWA contract ok');
