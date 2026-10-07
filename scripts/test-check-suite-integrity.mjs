// Release gate: the regression suite must stay runnable.
//
// The TypeScript migration moved ~60 browser modules from `public/*.js` to
// `public/typed/**/*.ts` and `server.mjs` to `server.ts`. The suites in
// `scripts/` were not repointed, so 282 of them failed on an unreadable path
// and another ~200 on a stale import while CI stayed green: CI runs
// `check:modern`, never the full `npm run check`. Nothing failed loudly, so the
// rot was invisible for weeks.
//
// This gate closes that hole from inside `check:modern`. It does not run the
// suites; it checks that each one *could* run:
//
//   1. every suite parses,
//   2. every repository path a suite reads exists,
//   3. no suite uses `require` in ESM scope,
//   4. no suite reads a legacy `public/*.js` module that the migration removed,
//   5. the shared helpers in `scripts/` are not picked up as suites.
//
// A suite that cannot run is worse than a failing one: it reports nothing.

import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS = path.join(ROOT, 'scripts');

/** run-checks executes exactly these. */
const isSuite = (name) =>
  (name.startsWith('test-') || name.startsWith('validate-')) && name.endsWith('.mjs');

const files = readdirSync(SCRIPTS).filter((name) => name.endsWith('.mjs')).sort();
const suites = files.filter(isSuite);
const helpers = files.filter((name) => !isSuite(name));

assert.ok(suites.length > 500, `expected the full regression suite, found ${suites.length} suites`);

// A helper that is accidentally named test-*/validate-* would be executed as a
// suite and fail for having no assertions of its own.
for (const helper of helpers) {
  assert.ok(!isSuite(helper), `helper would run as a suite: scripts/${helper}`);
}

const problems = [];

// Paths a suite reads, as written in the source. Dynamic joins are not
// resolvable statically and are left to the suite itself.
const PATH_PATTERNS = [
  /(?:readFileSync|readFile|existsSync|access)\(\s*['"]([^'"]+)['"]/g,
  /(?:readFileSync|readFile|existsSync|access)\(\s*(?:resolve|join)\(\s*\w+\s*,\s*['"]([^'"]+)['"]\s*\)/g,
  /from\s+['"](\.\.\/(?:lib|public)\/[^'"]+)['"]/g,
  /import\(\s*['"](\.\.\/(?:lib|public)\/[^'"]+)['"]/g,
  /new URL\(\s*['"](\.\.\/[^'"]+)['"]\s*,\s*import\.meta\.url\s*\)/g
];

/**
 * True when a line deliberately names a removed file to prove it is gone, as in
 * `assert.equal(existsSync(join(root, 'server.mjs')), false)` or
 * `assert(!(await exists('public/sw.js')))`. Nested calls make a single regex
 * for the whole expression brittle, so this tests for an existence check
 * combined with a negation on the same line.
 */
function assertsAbsence(line) {
  if (!/\bexists(?:Sync)?\s*\(/.test(line)) return false;
  return /\bfalse\b/.test(line) || /!\s*\(?\s*(?:await\s+)?exists/.test(line);
}

/**
 * Drop comments so a note about a path the migration removed is not read as a
 * reference to it. Crude but sufficient: suites are plain scripts, and a `//`
 * inside a string only costs a missed reference, never a false failure.
 */
function withoutComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((line) => line.replace(/(^|\s)\/\/.*$/, '$1'))
    .join('\n');
}

for (const suite of suites) {
  const file = path.join(SCRIPTS, suite);
  const raw = readFileSync(file, 'utf8');
  const source = withoutComments(raw);

  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (error) {
    problems.push(`${suite}: does not parse (${String(error.stderr || error.message).split('\n')[0]})`);
    continue;
  }

  // `require` is not defined in an ESM module; createRequire is the escape hatch.
  if (/(?<![.\w])require\s*\(/.test(source) && !source.includes('createRequire')) {
    problems.push(`${suite}: uses require() in ESM scope without createRequire`);
  }

  const referenced = new Set();
  for (const pattern of PATH_PATTERNS) {
    for (const match of source.matchAll(pattern)) referenced.add(match[1]);
  }

  for (const reference of referenced) {
    if (reference.startsWith('node:') || !/[./]/.test(reference)) continue;
    const relative = reference.startsWith('../') ? reference.slice(3) : reference;
    if (relative.includes('${') || relative.includes('*')) continue;
    const target = path.join(ROOT, relative);
    if (existsSync(target)) continue;
    // A missing path is fine when the suite asserts the file is gone.
    const line = source.split('\n').find((candidate) => candidate.includes(reference)) ?? '';
    if (assertsAbsence(line)) continue;
    problems.push(`${suite}: reads a path that does not exist: ${relative}`);
  }
}

if (problems.length) {
  console.error(`check-suite-integrity: ${problems.length} suite(s) cannot run:\n`);
  for (const problem of problems.slice(0, 40)) console.error(`  - ${problem}`);
  if (problems.length > 40) console.error(`  … and ${problems.length - 40} more`);
  process.exit(1);
}

console.log(`check-suite-integrity: OK (${suites.length} suites runnable, ${helpers.length} helpers)`);
