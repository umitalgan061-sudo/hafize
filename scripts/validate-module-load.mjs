// Import-time smoke check for the backend runtime.
//
// Several modules build state while being imported — `lib/tool-runtime.mjs`
// constructs the builtin skills runtime, `lib/production-guard.mjs` installs the
// production boundary. A module that throws at import time does not degrade one
// feature: it stops `npm start` before the first request, and unit suites that
// never import that module stay green while the product is down. So every
// backend module is imported here, in isolation from any request.
//
// The check must never need network access, a Redis instance, a provider key or
// a writable data directory: a module that demands those at import time is
// itself the defect this guard is looking for.
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CHECK_ROOT } from './check-support.mjs';

const libDir = path.join(CHECK_ROOT, 'lib');
const entries = await readdir(libDir, { withFileTypes: true });
const modules = entries
  .filter((entry) => entry.isFile() && entry.name.endsWith('.mjs'))
  // The production guard is exercised end to end by test-production-hardening;
  // importing it here would install its process level boundary in the checker.
  .filter((entry) => entry.name !== 'production-guard.mjs')
  .map((entry) => entry.name)
  .sort();

assert.ok(modules.length > 0, 'no backend modules were discovered');

const failures = [];
for (const name of modules) {
  try {
    await import(pathToFileURL(path.join(libDir, name)).href);
  } catch (error) {
    failures.push(`${name}: ${error?.code || error?.message || 'IMPORT_FAILED'}`);
  }
}

assert.deepEqual(failures, [], `backend modules must import cleanly: ${failures.join('; ')}`);

console.log(`Module load OK: ${modules.length} backend modules import without configuration, network or storage`);
