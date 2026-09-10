// Shared helpers for the static contract checks in scripts/test-*.mjs.
// They keep source-text assertions focused on behaviour instead of formatting
// details (CSS whitespace) or values that legitimately change every release
// (the service worker shell cache version).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CHECK_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function readProjectFile(relativePath) {
  return readFileSync(path.join(CHECK_ROOT, relativePath), 'utf8');
}

/**
 * Collapse every whitespace run in a stylesheet so assertions such as
 * `@media (max-width:560px)` match regardless of how the CSS is formatted.
 */
export function compactCss(css) {
  return String(css ?? '').replace(/\s+/g, '');
}

/** Assert that a stylesheet declares a media query, ignoring formatting. */
export function hasMediaQuery(css, feature) {
  return compactCss(css).includes(`@media(${compactCss(feature)})`);
}

const CACHE_VERSION_PATTERN = /CURRENT_CACHE\s*=\s*`\$\{CACHE_PREFIX\}(v\d+)`/;

/**
 * The single source of truth for the shipped service worker shell cache.
 * Tests assert against this instead of a hardcoded version so that a normal
 * cache bump does not turn unrelated suites red.
 */
export function readShellCacheVersion(swPolicySource = readProjectFile('public/sw-policy.js')) {
  const match = CACHE_VERSION_PATTERN.exec(swPolicySource);
  if (!match) throw new Error('SHELL_CACHE_VERSION_NOT_FOUND');
  return match[1];
}

export function readShellCacheName(swPolicySource) {
  return `hafize-shell-${readShellCacheVersion(swPolicySource)}`;
}

/** Every shell cache version strictly older than the shipped one. */
export function previousShellCacheNames(count = 4, swPolicySource) {
  const current = Number(readShellCacheVersion(swPolicySource).slice(1));
  const names = [];
  for (let version = current - 1; version > 0 && names.length < count; version -= 1) {
    names.push(`hafize-shell-v${version}`);
  }
  return names;
}
