import assert from 'node:assert/strict';

const CACHE_NAME_PATTERN = /^hafize-shell-v(\d+)$/;
const SOURCE_PATTERN = /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v(\d+)`/;

// The shell cache version is bumped every time a release changes the cached asset
// set, so pinning a test to one exact version makes an unrelated bump fail the gate.
// What a feature test actually needs to know is: the version is well formed, and it
// is at least the version that shipped that feature's assets.

export function shellCacheVersion(policy) {
  const match = CACHE_NAME_PATTERN.exec(String(policy?.CURRENT_CACHE ?? ''));
  assert.ok(match, `CURRENT_CACHE must look like hafize-shell-v<n>, got ${policy?.CURRENT_CACHE}`);
  return Number(match[1]);
}

export function assertShellCacheAtLeast(policy, minimum) {
  const version = shellCacheVersion(policy);
  assert.ok(version >= minimum, `shell cache version ${version} must not fall below v${minimum}`);
  return version;
}

export function assertShellCacheSourceAtLeast(source, minimum) {
  const match = SOURCE_PATTERN.exec(String(source ?? ''));
  assert.ok(match, 'sw-policy.js must derive CURRENT_CACHE from CACHE_PREFIX');
  const version = Number(match[1]);
  assert.ok(version >= minimum, `shell cache version ${version} must not fall below v${minimum}`);
  return version;
}
