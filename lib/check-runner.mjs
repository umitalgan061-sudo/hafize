import { readdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import path from 'node:path';

const SYNTAX_TARGETS = Object.freeze([
  Object.freeze({ directory: 'lib', extensions: Object.freeze(['.mjs']) }),
  Object.freeze({ directory: 'scripts', extensions: Object.freeze(['.mjs']) }),
  Object.freeze({ directory: 'public', extensions: Object.freeze(['.js']) })
]);
const ROOT_SYNTAX_FILES = Object.freeze(['server.mjs']);
const EXTRA_TESTS = Object.freeze(['scripts/validate-agent-registry.mjs']);
const TEST_PREFIX = 'test-';
const TEST_DIRECTORY = 'scripts';
const TEST_EXTENSION = '.mjs';
const DEFAULT_TEST_TIMEOUT_MS = 120_000;

function fail(field) {
  throw new Error(`INVALID_CHECK_PLAN:${field}`);
}

export function normalizeFilters(values = []) {
  if (!Array.isArray(values)) fail('filters');
  const filters = [];
  for (const value of values) {
    if (typeof value !== 'string') fail('filters');
    const normalized = value.trim().toLowerCase();
    if (normalized) filters.push(normalized);
  }
  return Object.freeze(filters);
}

export function matchesFilters(target, filters) {
  if (!filters.length) return true;
  const normalized = String(target).toLowerCase();
  return filters.some((filter) => normalized.includes(filter));
}

async function defaultReadDirectory(directory) {
  try {
    return await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
}

function fileNames(entries) {
  return entries
    .filter((entry) => (typeof entry?.isFile === 'function' ? entry.isFile() : true))
    .map((entry) => (typeof entry === 'string' ? entry : entry.name))
    .filter((name) => typeof name === 'string' && name);
}

/**
 * Doğrulama kapısı elle tutulan bir listeye değil, depodaki gerçek dosyalara dayanır:
 * yeni bir `scripts/test-*.mjs` eklendiğinde kapı onu package.json düzenlenmeden çalıştırır.
 */
export async function discoverCheckPlan({ rootDir = process.cwd(), readDirectory = defaultReadDirectory, filters = [] } = {}) {
  if (typeof rootDir !== 'string' || !rootDir) fail('rootDir');
  if (typeof readDirectory !== 'function') fail('readDirectory');
  const activeFilters = normalizeFilters(filters);
  const syntaxChecks = [];

  for (const file of ROOT_SYNTAX_FILES) {
    if (matchesFilters(file, activeFilters)) syntaxChecks.push(file);
  }
  for (const target of SYNTAX_TARGETS) {
    const entries = await readDirectory(path.join(rootDir, target.directory));
    for (const name of fileNames(entries).sort()) {
      if (!target.extensions.some((extension) => name.endsWith(extension))) continue;
      const relative = `${target.directory}/${name}`;
      if (matchesFilters(relative, activeFilters)) syntaxChecks.push(relative);
    }
  }

  const testEntries = fileNames(await readDirectory(path.join(rootDir, TEST_DIRECTORY))).sort();
  const tests = [];
  for (const file of EXTRA_TESTS) {
    if (!testEntries.includes(path.basename(file))) continue;
    if (matchesFilters(file, activeFilters)) tests.push(file);
  }
  for (const name of testEntries) {
    if (!name.startsWith(TEST_PREFIX) || !name.endsWith(TEST_EXTENSION)) continue;
    const relative = `${TEST_DIRECTORY}/${name}`;
    if (matchesFilters(relative, activeFilters)) tests.push(relative);
  }

  return Object.freeze({
    syntaxChecks: Object.freeze(syntaxChecks),
    tests: Object.freeze(tests.filter((file, index) => tests.indexOf(file) === index))
  });
}

function defaultRunNode({ args, rootDir, timeoutMs }) {
  return new Promise((resolve) => {
    execFile(process.execPath, args, { cwd: rootDir, timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({ ok: !error, output: `${stdout || ''}${stderr || ''}`.trim() });
    });
  });
}

export async function runCheckPlan(plan, { rootDir = process.cwd(), runNode = defaultRunNode, log = () => {}, timeoutMs = DEFAULT_TEST_TIMEOUT_MS } = {}) {
  if (!plan || typeof plan !== 'object') fail('plan');
  if (!Array.isArray(plan.syntaxChecks) || !Array.isArray(plan.tests)) fail('plan');
  if (typeof runNode !== 'function') fail('runNode');

  const failures = [];
  let executed = 0;

  for (const file of plan.syntaxChecks) {
    const result = await runNode({ args: ['--check', file], rootDir, timeoutMs, file, kind: 'syntax' });
    executed += 1;
    if (result?.ok) continue;
    failures.push({ kind: 'syntax', file, output: String(result?.output || '').slice(0, 4000) });
    log(`FAIL syntax ${file}`);
  }

  for (const file of plan.tests) {
    const result = await runNode({ args: [file], rootDir, timeoutMs, file, kind: 'test' });
    executed += 1;
    if (result?.ok) {
      log(`ok   test   ${file}`);
      continue;
    }
    failures.push({ kind: 'test', file, output: String(result?.output || '').slice(0, 4000) });
    log(`FAIL test   ${file}`);
  }

  return Object.freeze({
    executed,
    syntaxChecked: plan.syntaxChecks.length,
    testsRun: plan.tests.length,
    failures: Object.freeze(failures),
    ok: failures.length === 0
  });
}

export const CHECK_RUNNER_TARGETS = Object.freeze({
  rootSyntaxFiles: ROOT_SYNTAX_FILES,
  syntaxTargets: SYNTAX_TARGETS,
  extraTests: EXTRA_TESTS,
  testPrefix: TEST_PREFIX
});
