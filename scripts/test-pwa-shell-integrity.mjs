// Shell-cache integrity after the TypeScript migration.
//
// `cache.addAll()` rejects as a whole, so a single stale or duplicated entry in
// SHELL_ASSETS disables the offline shell completely. This suite asserts the
// version-independent invariants plus the two failure modes the migration
// introduced: cached paths whose file no longer exists, and legacy `public/*.js`
// shims re-importing a `/typed-build/*.js` path that is not a Vite entry.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  CURRENT_CACHE_VERSION,
  LEGACY_BRIDGE_FILES,
  PUBLIC_DIR,
  ROOT,
  TYPED_BUILD_PREFIX,
  assertLegacyBridgeTargets,
  assertShellCacheContract,
  dynamicShellAssets,
  indexHtmlAssets,
  referencedShellAssets,
  shellAssetFile,
  swPolicy as policy,
  typedBuildEntrySources
} from './shell-cache-contract.mjs';

assertShellCacheContract();
assertLegacyBridgeTargets();

// Every `/typed-build/*.js` path in the shell list is a declared Vite entry, so
// `npm run build` actually produces the file the service worker asks for.
const entries = typedBuildEntrySources();
assert.ok(entries.size > 0, 'vite.config.ts declares build entries');
const cachedBuildPaths = policy.SHELL_ASSETS.filter((asset) => asset.startsWith(TYPED_BUILD_PREFIX));
assert.ok(cachedBuildPaths.length > 0, 'the shell caches built TypeScript entries');
for (const asset of cachedBuildPaths) {
  const entryName = asset.slice(TYPED_BUILD_PREFIX.length).replace(/\.js$/, '');
  assert.ok(entries.has(entryName), `${asset} is produced by a Vite entry`);
  const source = entries.get(entryName);
  assert.ok(existsSync(path.join(ROOT, source)), `${asset} entry source ${source} exists`);
}

// The same holds for the page: index.html must not load a built module that no
// entry produces, or the browser gets a 404 on boot.
for (const asset of indexHtmlAssets()) {
  if (!asset.startsWith(TYPED_BUILD_PREFIX)) continue;
  const entryName = asset.slice(TYPED_BUILD_PREFIX.length).replace(/\.js$/, '');
  assert.ok(entries.has(entryName), `index.html asset ${asset} is produced by a Vite entry`);
}

// No pre-migration `public/<name>.js` path survives in the shell list: those
// files are gone, and a missing entry breaks `addAll()` for every other asset.
for (const asset of policy.SHELL_ASSETS) {
  const file = shellAssetFile(asset);
  assert.ok(file, `shell asset ${asset} resolves to a local path`);
  assert.ok(existsSync(file), `shell asset ${asset} is backed by ${path.relative(ROOT, file)}`);
}

// Runtime loaders inject their own tags, so their assets are cached even though
// index.html never mentions them.
const dynamic = new Set(dynamicShellAssets());
assert.ok(dynamic.size > 0, 'runtime loaders reference same-origin assets');
const referenced = referencedShellAssets();
for (const asset of indexHtmlAssets()) assert.ok(referenced.has(asset), `${asset} counts as referenced`);

// The shims are a compatibility surface, not shell assets: they must exist,
// target a real entry, and stay out of the cache list.
for (const name of LEGACY_BRIDGE_FILES) {
  const file = path.join(PUBLIC_DIR, name);
  if (!existsSync(file)) continue;
  const source = readFileSync(file, 'utf8');
  assert.doesNotMatch(source, /typed-build\/[^']*\.ts\.js/, `${name} must not import a .ts.js path`);
  assert.equal(policy.SHELL_ASSETS.includes('/' + name), false, `/${name} is not a shell asset`);
}

assert.ok(CURRENT_CACHE_VERSION >= 48, 'shell cache version is bumped for the integrity fixes');

console.log(`PWA shell integrity OK: v${CURRENT_CACHE_VERSION}, ${policy.SHELL_ASSETS.length} assets, ${entries.size} Vite entries`);
