// Shared loader for the Prompt Library browser module.
//
// `public/typed/prompt-library.ts` is a UMD module: under CommonJS it assigns
// `module.exports`, and everywhere else it attaches its API to the global. Node
// loads it as ESM, so there is no `module` and the API arrives on `globalThis`.
// This module is a helper, not a suite (run-checks only executes test-*/validate-*).

import { createStorageStub } from './browser-storage-stub.mjs';

/**
 * Loads the module and returns its API from the global it publishes to.
 * Installs an in-memory `localStorage` first, because the storage helpers read
 * `root.localStorage` and must not touch a real browser store.
 */
export async function loadPromptLibrary({ storage = createStorageStub() } = {}) {
  globalThis.localStorage = storage;
  await import('../public/typed/prompt-library.ts');
  const api = globalThis.HafizePromptLibrary;
  if (!api) throw new Error('PROMPT_LIBRARY_API_MISSING');
  return api;
}

export { createStorageStub };
