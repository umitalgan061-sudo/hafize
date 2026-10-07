/**
 * Guard: every repository path that a check script reads must exist.
 *
 * The TypeScript migration moved browser and runtime sources (public/x.js ->
 * public/typed/legacy/x.ts, lib/x.mjs -> lib/x.ts). Check scripts that still
 * pointed at the old location failed with ENOENT/MODULE_NOT_FOUND, which hid
 * hundreds of real assertions behind a path error. This validator fails fast on
 * the next dangling reference instead of letting the gate rot again.
 *
 * Intentional "this legacy file must stay deleted" assertions are declared in
 * EXPECTED_ABSENT and are the only references allowed to point at a missing path.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT_DIR = path.join(ROOT, 'scripts');
const WATCHED_ROOTS = ['public', 'lib', 'docs', 'agents', 'skills', 'scripts'];
const WATCHED_EXTENSIONS = new Set(['.js', '.mjs', '.ts', '.css', '.html', '.json', '.md', '.webmanifest']);

/** Suite -> paths it asserts are absent on purpose (legacy removal gates). */
const EXPECTED_ABSENT = Object.freeze({
  'test-nextgen-release.mjs': ['public/sw-policy.js', 'public/sw.js'],
  'test-prompt-library-bulk-organizer-ts.mjs': ['public/prompt-library-bulk-organizer.js'],
  'test-runtime-modernization.mjs': ['public/sw-policy.js', 'public/sw.js'],
  'test-runtime-modernization.ts': ['public/sw-policy.js', 'public/sw.js'],
  'test-typescript-entrypoints-release.mjs': [
    'public/app.js',
    'public/auth.js',
    'public/ui-shell.js',
    'public/voice-input.js',
    'public/voice-output.js'
  ]
});

/**
 * Only references a suite actually loads are checked. Inline fixture data such as
 * `{ path: 'lib/a.mjs', content: '...' }` names a file that never has to exist,
 * and a `vm` filename label is not a read either.
 */
const READ_CONTEXT = /readFile|readFileSync|createRequire|require\(|import\(|exists|statSync|access|openSync|new URL|readdir/;

const CONTIGUOUS = new RegExp(
  `['"\`](?:\\.\\./)?((?:${WATCHED_ROOTS.join('|')})/[A-Za-z0-9._/-]+)['"\`]`,
  'g'
);
const SEGMENTED = new RegExp(`['"\`](${WATCHED_ROOTS.join('|')})['"\`]\\s*,\\s*['"\`]([A-Za-z0-9._-]+)['"\`]`, 'g');

function watched(reference) {
  return WATCHED_EXTENSIONS.has(path.extname(reference));
}

function collectReferences(source) {
  const references = new Set();
  for (const line of source.split('\n')) {
    if (!READ_CONTEXT.test(line)) continue;
    for (const match of line.matchAll(CONTIGUOUS)) references.add(match[1]);
    for (const match of line.matchAll(SEGMENTED)) references.add(`${match[1]}/${match[2]}`);
  }
  return [...references].filter(watched);
}

const SELF = path.basename(fileURLToPath(import.meta.url));
const files = readdirSync(SCRIPT_DIR)
  .filter((name) => (name.endsWith('.mjs') || name.endsWith('.ts')) && name !== SELF)
  .sort();
const dangling = [];
const staleAllowlist = [];

for (const file of files) {
  const source = readFileSync(path.join(SCRIPT_DIR, file), 'utf8');
  const allowed = new Set(EXPECTED_ABSENT[file] ?? []);
  for (const reference of collectReferences(source)) {
    if (existsSync(path.join(ROOT, reference))) continue;
    if (allowed.has(reference)) continue;
    dangling.push(`${file} -> ${reference}`);
  }
  // An allowlist entry is stale once the path comes back or the suite stops
  // naming it, which means the legacy-removal assertion no longer guards anything.
  for (const reference of allowed) {
    if (!source.includes(reference)) staleAllowlist.push(`${file} -> ${reference} (no longer referenced)`);
    else if (existsSync(path.join(ROOT, reference))) staleAllowlist.push(`${file} -> ${reference} (path exists again)`);
  }
}

if (dangling.length || staleAllowlist.length) {
  if (dangling.length) {
    console.error(`${dangling.length} dangling source reference(s) in check scripts:`);
    for (const entry of dangling) console.error(`  ${entry}`);
  }
  if (staleAllowlist.length) {
    console.error(`${staleAllowlist.length} stale EXPECTED_ABSENT entr(ies) — the path exists or is no longer referenced:`);
    for (const entry of staleAllowlist) console.error(`  ${entry}`);
  }
  process.exit(1);
}

console.log(`check source references: ok (${files.length} scripts scanned)`);
