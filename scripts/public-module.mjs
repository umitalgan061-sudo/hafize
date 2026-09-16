// Loader for the browser modules under `public/`.
//
// Those files are UMD: they attach their API to `globalThis` in the browser and
// to `module.exports` under Node. `module.exports` is assigned as a whole, so
// Node's static CommonJS export detection finds no named exports and
// `import { X } from '../public/…'` throws at link time. Requiring the module
// gives the same object with none of that ambiguity.
// This module is a helper, not a suite (run-checks only executes test-*/validate-*).

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** Loads `public/<fileName>` and returns the API object it exports. */
export function loadPublicModule(fileName) {
  return require(`../public/${fileName}`);
}
