import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const index = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const vite = fs.readFileSync(path.join(root, 'vite.config.ts'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'public/sw-policy.js'), 'utf8');

for (const asset of ['github-workspace.css', 'github-workspace-extra.css', 'typed-build/github-workspace.js', 'typed-build/github-workspace-extra.js', 'typed-build/github-workspace-actions.js']) {
  assert.match(index, new RegExp(asset.replace(/[/.]/g, '\\$&')));
  assert.match(vite, new RegExp(asset.includes('typed-build') ? asset.split('/').pop().replace(/[/.]/g, '\\$&') : 'github-workspace'));
}
for (const asset of ['/github-workspace.css', '/github-workspace-extra.css', '/typed-build/github-workspace.js', '/typed-build/github-workspace-extra.js', '/typed-build/github-workspace-actions.js']) {
  assert.match(sw, new RegExp(asset.replace(/[/.]/g, '\\$&')));
}
assert.match(sw, /pathname\.startsWith\('\/api\/'\)/);
console.log('github-workspace-pwa: ok');
