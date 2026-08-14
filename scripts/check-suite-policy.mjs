import { readdir } from 'node:fs/promises';
import path from 'node:path';

export const CHECK_SOURCE_ROOTS = Object.freeze(['lib', 'public', 'desktop', 'scripts']);
export const CHECK_SOURCE_FILES = Object.freeze(['server.mjs']);
export const CHECK_VALIDATORS = Object.freeze(['scripts/validate-agent-registry.mjs']);
export const CHECK_OPT_IN_TESTS = Object.freeze([
  Object.freeze({
    path: 'scripts/test-redis-schedule-lease-live.mjs',
    reason: 'requires an explicitly configured external Redis endpoint',
    command: 'HAFIZE_TEST_REDIS_URL=redis://... node scripts/test-redis-schedule-lease-live.mjs'
  })
]);

const SOURCE_EXTENSIONS = new Set(['.js', '.mjs']);

function fail(code, detail = '') {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
}

function normalizeRelative(value) {
  return value.split(path.sep).join('/');
}

async function walk(rootDir, relativeDir) {
  const absolute = path.join(rootDir, relativeDir);
  let entries;
  try {
    entries = await readdir(absolute, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') fail('CHECK_SOURCE_ROOT_MISSING', relativeDir);
    throw error;
  }

  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const relative = normalizeRelative(path.join(relativeDir, entry.name));
    if (entry.isDirectory()) files.push(...await walk(rootDir, relative));
    else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) files.push(relative);
  }
  return files;
}

function isTestFile(file) {
  return file.startsWith('scripts/test-') && file.endsWith('.mjs') && !file.includes('/../');
}

export async function discoverCheckPlan({
  rootDir = process.cwd(),
  sourceRoots = CHECK_SOURCE_ROOTS,
  sourceFiles = CHECK_SOURCE_FILES,
  validators = CHECK_VALIDATORS,
  optInTests = CHECK_OPT_IN_TESTS
} = {}) {
  if (!rootDir || !Array.isArray(sourceRoots) || sourceRoots.length === 0) fail('INVALID_CHECK_POLICY');

  const syntaxSet = new Set();
  for (const sourceRoot of sourceRoots) {
    if (typeof sourceRoot !== 'string' || !sourceRoot || path.isAbsolute(sourceRoot) || sourceRoot.includes('..')) {
      fail('INVALID_CHECK_SOURCE_ROOT', String(sourceRoot));
    }
    for (const file of await walk(rootDir, sourceRoot)) syntaxSet.add(file);
  }
  for (const sourceFile of sourceFiles) {
    if (typeof sourceFile !== 'string' || !sourceFile || path.isAbsolute(sourceFile) || sourceFile.includes('..')) {
      fail('INVALID_CHECK_SOURCE_FILE', String(sourceFile));
    }
    try {
      const entries = await readdir(path.dirname(path.join(rootDir, sourceFile)));
      if (!entries.includes(path.basename(sourceFile))) fail('CHECK_SOURCE_FILE_MISSING', sourceFile);
    } catch (error) {
      if (error?.code === 'ENOENT') fail('CHECK_SOURCE_FILE_MISSING', sourceFile);
      throw error;
    }
    syntaxSet.add(normalizeRelative(sourceFile));
  }
  const syntaxFiles = [...syntaxSet].sort();
  const discoveredTests = syntaxFiles.filter(isTestFile);
  const optInPaths = new Set();

  for (const entry of optInTests) {
    if (!entry || typeof entry.path !== 'string' || typeof entry.reason !== 'string' || !entry.reason.trim()) {
      fail('INVALID_CHECK_OPT_IN_TEST');
    }
    if (optInPaths.has(entry.path)) fail('DUPLICATE_CHECK_OPT_IN_TEST', entry.path);
    if (!discoveredTests.includes(entry.path)) fail('CHECK_OPT_IN_TEST_MISSING', entry.path);
    optInPaths.add(entry.path);
  }

  for (const validator of validators) {
    if (!syntaxFiles.includes(validator)) fail('CHECK_VALIDATOR_MISSING', validator);
  }

  return Object.freeze({
    syntaxFiles: Object.freeze(syntaxFiles),
    validators: Object.freeze([...validators]),
    tests: Object.freeze(discoveredTests.filter((file) => !optInPaths.has(file))),
    optInTests: Object.freeze(optInTests.map((entry) => Object.freeze({ ...entry })))
  });
}

export function summarizeCheckPlan(plan) {
  if (!plan || !Array.isArray(plan.syntaxFiles) || !Array.isArray(plan.tests)) fail('INVALID_CHECK_PLAN');
  return Object.freeze({
    syntaxFiles: plan.syntaxFiles.length,
    validators: plan.validators.length,
    tests: plan.tests.length,
    optInTests: plan.optInTests.length
  });
}
