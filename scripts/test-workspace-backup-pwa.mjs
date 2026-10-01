import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const html = await readFile(new URL('public/index.html', root), 'utf8');
const sw = await readFile(new URL('public/sw-policy.js', root), 'utf8');
const vite = await readFile(new URL('vite.config.ts', root), 'utf8');
for (const marker of ['workspace-backup.css','typed-build/workspace-backup.js']) assert.ok(html.includes(marker), 'HTML marker missing: ' + marker);
for (const marker of ['workspace-backup','public/typed/workspace-backup.ts','typed-build/workspace-backup.js']) assert.ok(vite.includes(marker), 'Vite marker missing: ' + marker);
for (const marker of ['/workspace-backup.css','/typed-build/workspace-backup.js','CURRENT_CACHE']) assert.ok(sw.includes(marker), 'PWA marker missing: ' + marker);
const { SHELL_ASSETS, classifyRequest } = await import('../public/sw-policy.js').then((m) => m.default ?? m);
assert.equal(SHELL_ASSETS.some((asset) => asset.startsWith('/api/')), false, 'no API path is precached');
assert.equal(
  classifyRequest({ method: 'GET', url: 'https://hafize.example/api/workspace/backup', headers: {} }, 'https://hafize.example'),
  'network-only',
  'API requests bypass the shell cache'
);
console.log('workspace-backup-pwa: OK');
