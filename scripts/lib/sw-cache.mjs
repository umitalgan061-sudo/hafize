import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const POLICY_URL = new URL('../../public/sw-policy.js', import.meta.url);
const VERSION_PATTERN = /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v(\d+)`/;

export function readServiceWorkerPolicySource() {
  return readFileSync(POLICY_URL, 'utf8');
}

export function currentShellCacheVersion(source = readServiceWorkerPolicySource()) {
  const match = VERSION_PATTERN.exec(source);
  assert.ok(match, 'public/sw-policy.js must declare CURRENT_CACHE = `${CACHE_PREFIX}v<n>`');
  return Number(match[1]);
}

/**
 * Every shipped shell change bumps the service worker cache once, so a feature
 * check should assert the bump it required rather than the exact version that
 * happened to be current when the feature landed. Otherwise the next feature's
 * bump breaks every older check.
 */
export function assertShellCacheAtLeast(version, label = 'feature') {
  const current = currentShellCacheVersion();
  assert.ok(
    current >= version,
    `${label} needs the shell cache at v${version} or newer, found v${current}`
  );
  return current;
}

export function assertShellAssetsCached(assets, source = readServiceWorkerPolicySource()) {
  for (const asset of assets) {
    assert.ok(source.includes(`'${asset}'`), `sw-policy.js must cache ${asset}`);
  }
}
