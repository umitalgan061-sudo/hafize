import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assertShellAssets, assertVersionedCacheDeclaration, swPolicy } from './shell-cache-contract.mjs';
const html = fs.readFileSync('public/index.html', 'utf8');
const sw = fs.readFileSync('public/sw-policy.js', 'utf8');
const ASSETS = ['/composer-history.css','/composer-history.js','/composer-history-panel.js','/composer-history-backup.js','/composer-history-help.js','/composer-history-settings.js'];
for (const asset of ASSETS) assert.match(html, new RegExp(asset.replaceAll('/','\\/')));
assertShellAssets(ASSETS, 'composer history asset');
assertVersionedCacheDeclaration(sw);
// The shell cache stays a shell cache: no API response is ever pre-cached.
assert.equal(swPolicy.SHELL_ASSETS.some((asset) => asset.startsWith('/api/')), false);
console.log('composer history PWA contract: ok');
