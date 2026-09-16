import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assertShellAssets, assertVersionedCacheDeclaration, swPolicy } from './shell-cache-contract.mjs';

const COMPOSER_HISTORY_ASSETS = [
  '/composer-history.css',
  '/composer-history.js',
  '/composer-history-panel.js',
  '/composer-history-backup.js',
  '/composer-history-help.js',
  '/composer-history-settings.js'
];

const html = fs.readFileSync('public/index.html', 'utf8');
const sw = fs.readFileSync('public/sw-policy.js', 'utf8');

// The panel has to keep working offline, so index.html must load every asset and
// the service worker must precache the same set.
for (const asset of COMPOSER_HISTORY_ASSETS) {
  assert.match(html, new RegExp(asset.replaceAll('/', '\\/')), `index.html loads ${asset}`);
}
assertShellAssets(COMPOSER_HISTORY_ASSETS, 'composer history asset');
assertVersionedCacheDeclaration(sw);

// Submission history is device-local: no API response may ever enter the shell cache.
// Assert that over the parsed asset list rather than the file text, so the
// `pathname.startsWith('/api/')` network-only rule does not trip the check.
assert.equal(
  swPolicy.SHELL_ASSETS.some((asset) => asset.startsWith('/api/')),
  false,
  'no API path is precached'
);

console.log('composer history PWA contract: ok');
