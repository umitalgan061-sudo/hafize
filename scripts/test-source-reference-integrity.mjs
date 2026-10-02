// Guards against the failure mode that followed the TypeScript migration waves: source
// files were renamed (public/*.js -> public/typed/**/*.ts, lib/*.mjs -> lib/*.ts) while
// hundreds of check suites kept naming the old paths. Each suite then failed with its own
// ENOENT, which is noisy and easy to mistake for unrelated breakage. This contract fails
// once, listing every stale reference, so a rename is caught in one obvious place.
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Paths a suite names deliberately to assert the legacy file is gone. Keep them literal:
// an entry here is a promise that the path must NOT exist.
const INTENTIONALLY_ABSENT = new Set([
  'public/app.js',
  'public/auth.js',
  'public/ui-shell.js',
  'public/voice-input.js',
  'public/voice-output.js',
  'public/sw.js',
  'public/sw-policy.js',
  'public/chat-composer-features.js',
  'public/chat-history-search.js',
  'public/chat-history-management.js',
  'public/hands-free.js',
  'public/hands-free-background-guard.js',
  'public/settings-privacy.js',
  'public/workspace-navigation.js',
  'server.mjs',
  // Fixture paths used as test data for the reviewer gates, not real files.
  'lib/a.mjs',
  'lib/app.mjs'
]);

const REFERENCE = /(['"`])((?:\.\.\/)?(?:public|lib|agents|skills)\/[A-Za-z0-9._/-]+\.(?:js|mjs|cjs|ts))\1/g;

const scripts = (await readdir(path.join(ROOT, 'scripts'))).filter((name) => name.endsWith('.mjs')).sort();
const stale = [];
const absentButPresent = [];

for (const name of scripts) {
  const source = await readFile(path.join(ROOT, 'scripts', name), 'utf8');
  const seen = new Set();
  for (const match of source.matchAll(REFERENCE)) {
    const rel = match[2].replace(/^\.\.\//, '');
    if (seen.has(rel)) continue;
    seen.add(rel);
    const exists = existsSync(path.join(ROOT, rel));
    if (INTENTIONALLY_ABSENT.has(rel)) {
      if (exists) absentButPresent.push(`${name} -> ${rel}`);
    } else if (!exists) {
      stale.push(`${name} -> ${rel}`);
    }
  }
}

if (stale.length) {
  console.error(`${stale.length} check suite(s) reference a source path that no longer exists:`);
  for (const entry of stale) console.error(`  ${entry}`);
  console.error('\nRepoint the reference, or add the path to INTENTIONALLY_ABSENT if the file is meant to be gone.');
  process.exit(1);
}
if (absentButPresent.length) {
  console.error(`${absentButPresent.length} path(s) are asserted absent but exist on disk:`);
  for (const entry of absentButPresent) console.error(`  ${entry}`);
  process.exit(1);
}

console.log(`source reference integrity: ok (${scripts.length} suites)`);
