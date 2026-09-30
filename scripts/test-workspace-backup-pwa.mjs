import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { swPolicy } from './shell-cache-contract.mjs';
const root = new URL('../', import.meta.url);
const html = await readFile(new URL('public/index.html', root), 'utf8');
const sw = await readFile(new URL('public/sw-policy.js', root), 'utf8');
const vite = await readFile(new URL('vite.config.ts', root), 'utf8');
for (const marker of ['workspace-backup.css','typed-build/workspace-backup.js']) assert.ok(html.includes(marker), 'HTML marker missing: ' + marker);
for (const marker of ['workspace-backup','public/typed/workspace-backup.ts','typed-build/workspace-backup.js']) assert.ok(vite.includes(marker), 'Vite marker missing: ' + marker);
for (const marker of ['/workspace-backup.css','/typed-build/workspace-backup.js','CURRENT_CACHE']) assert.ok(sw.includes(marker), 'PWA marker missing: ' + marker);
// `sw-policy.js` must contain `/api/` — that is the network-only guard. What
// must not contain it is the shell asset list, which is what this checks.
assert.match(sw, /pathname\.startsWith\('\/api\/'\)/);
assert.equal(swPolicy.SHELL_ASSETS.some((asset) => asset.startsWith('/api/')), false, 'no API path is cached');
console.log('workspace-backup-pwa: OK');
