// Shared contract for the legacy `.mjs` compatibility bridges.
//
// Every bridge re-exports one canonical TypeScript module and contains no logic
// of its own. The convention in the repository is a comment naming the canonical
// source followed by the single re-export, so a gate must assert the *shape*
// rather than one exact byte sequence — otherwise adding a comment reads as
// drift while adding real code can hide behind a matching first line.
// This module is a helper, not a suite (run-checks only executes test-*/validate-*).

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/** Statement lines of a bridge, with comments and blank lines removed. */
export function bridgeStatements(source) {
  return source
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('//'));
}

/**
 * Asserts `file` is a pure re-export bridge for `./<canonical>.ts`.
 * `file` is repository-relative, e.g. `lib/config-readiness.mjs`.
 */
export function assertLegacyBridge(file, canonical = path.basename(file, '.mjs')) {
  const source = readFileSync(path.join(ROOT, file), 'utf8');
  const statements = bridgeStatements(source);
  assert.deepEqual(
    statements,
    [`export * from './${canonical}.ts';`],
    `legacy bridge ${file} must contain only the canonical re-export`
  );
  assert.doesNotMatch(source, /\b(?:function|class|const|let|var|import)\b/, `legacy bridge ${file} must hold no logic`);
}
