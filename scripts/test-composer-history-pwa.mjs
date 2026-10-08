import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assertShellAssets, assertVersionedCacheDeclaration, swPolicy } from './shell-cache-contract.mjs';
import { assertLegacyModulesBundled } from './legacy-bundle-contract.mjs';

const COMPOSER_HISTORY_ASSETS = [
  '/composer-history.css'
];

const html = fs.readFileSync('public/index.html', 'utf8');
const sw = fs.readFileSync('public/sw-policy.ts', 'utf8');

for (const asset of COMPOSER_HISTORY_ASSETS) {
  assert.match(html, new RegExp(asset.replaceAll('/', '\\/')), `index.html loads ${asset}`);
}
// Composer history is a local-only surface, so it has to keep working offline.
assertShellAssets(COMPOSER_HISTORY_ASSETS, 'composer history asset');
assertVersionedCacheDeclaration(sw);

// The `/api/` prefix appears in the classifier guard, so the contract is
// asserted on the asset list itself rather than on the file text.
assert.equal(
  swPolicy.SHELL_ASSETS.some((asset) => asset.startsWith('/api/')),
  false,
  'no API path is precached alongside the composer history shell'
);
assertLegacyModulesBundled(['composer-history', 'composer-history-panel', 'composer-history-backup', 'composer-history-help', 'composer-history-settings']);
console.log('composer history PWA contract: ok');
