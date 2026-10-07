/**
 * Loads a browser-side module for a Node check suite.
 *
 * The package is `type: module`, so Node resolves `public/**.ts` as ESM. The UMD
 * wrappers in those files test `typeof module === 'object'` to decide how to
 * publish their API, and under ESM that branch is never taken — `require()` on
 * such a module returns an empty namespace without exposing anything. A dynamic
 * import evaluates the module correctly: UMD modules then publish their API on
 * the global object, while fully migrated modules expose named ESM exports.
 *
 * This helper returns whichever surface the module actually has, so a suite does
 * not have to know which migration stage its module is in.
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function usableApi(value) {
  return Boolean(value) && (typeof value === 'object' || typeof value === 'function');
}

export async function loadBrowserModule(repoRelativePath) {
  const before = new Set(Object.keys(globalThis));
  const namespace = await import(pathToFileURL(path.join(ROOT, repoRelativePath)).href);
  const named = Object.keys(namespace).filter((key) => key !== 'default');
  if (named.length) return namespace;
  for (const key of Object.keys(globalThis)) {
    if (before.has(key) || !key.startsWith('Hafize')) continue;
    if (usableApi(globalThis[key])) return globalThis[key];
  }
  if (usableApi(namespace.default)) return namespace.default;
  throw new Error(`BROWSER_MODULE_EXPOSED_NO_API:${repoRelativePath}`);
}
