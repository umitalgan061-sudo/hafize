// Keeps the check gate from rotting the way it already did once: six suites
// pinned the shipped service worker cache version as a literal, so a routine
// shell cache bump turned unrelated suites red and the failures were then
// carried for several rounds.
//
// The shipped version has exactly one source of truth,
// `scripts/check-support.mjs#readShellCacheVersion()`. Older versions may still
// appear as stale-cache examples; only the current one may not be pinned.
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { CHECK_ROOT, readShellCacheVersion } from './check-support.mjs';

const shellVersion = readShellCacheVersion();
const currentCacheName = `hafize-shell-${shellVersion}`;
const currentCacheTemplate = `\${CACHE_PREFIX}${shellVersion}`;
const scriptsDir = path.join(CHECK_ROOT, 'scripts');
const entries = await readdir(scriptsDir, { withFileTypes: true });
const suites = entries
  .filter((entry) => entry.isFile() && /^(test|validate)-.*\.mjs$/.test(entry.name))
  .map((entry) => entry.name)
  .sort();

assert.ok(suites.length > 0, 'no check suites were discovered');

const offenders = [];
for (const suite of suites) {
  const source = await readFile(path.join(scriptsDir, suite), 'utf8');
  if (source.includes(currentCacheName) || source.includes(currentCacheTemplate)) offenders.push(suite);
}

assert.deepEqual(
  offenders,
  [],
  `suites must derive the shipped shell cache version with readShellCacheVersion() instead of pinning ${shellVersion}: ${offenders.join(', ')}`
);

console.log(`Check gate hygiene OK: ${suites.length} suites, none pin the shipped shell cache version (${shellVersion})`);
